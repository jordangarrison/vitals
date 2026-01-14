import sax from "sax";
import { createReadStream, readdirSync } from "fs";
import { resolve, basename } from "path";
import { getDatabase } from "../../db/client";
import { logger } from "../../utils/logger";

interface ParseStats {
  routesProcessed: number;
  linkedToWorkouts: number;
  errors: string[];
}

interface TrackPoint {
  lat: number;
  lon: number;
  ele?: number;
  time?: string;
  speed?: number;
}

interface GPXRoute {
  name?: string;
  startTime?: string;
  endTime?: string;
  points: TrackPoint[];
}

function parseGPXFile(filePath: string): Promise<GPXRoute> {
  return new Promise((resolve, reject) => {
    const parser = sax.createStream(true, { trim: true });
    const route: GPXRoute = { points: [] };
    let currentPoint: TrackPoint | null = null;
    let currentElement = "";
    let inExtensions = false;

    parser.on("opentag", (node: any) => {
      currentElement = node.name;

      if (node.name === "trkpt") {
        currentPoint = {
          lat: parseFloat(node.attributes.lat),
          lon: parseFloat(node.attributes.lon),
        };
      } else if (node.name === "extensions") {
        inExtensions = true;
      }
    });

    parser.on("text", (text: string) => {
      if (!currentPoint) {
        if (currentElement === "name") {
          route.name = text.trim();
        }
        return;
      }

      const trimmed = text.trim();
      if (!trimmed) return;

      if (currentElement === "ele") {
        currentPoint.ele = parseFloat(trimmed);
      } else if (currentElement === "time") {
        currentPoint.time = trimmed;
      } else if (inExtensions && currentElement === "speed") {
        currentPoint.speed = parseFloat(trimmed);
      }
    });

    parser.on("closetag", (name: string) => {
      if (name === "trkpt" && currentPoint) {
        route.points.push(currentPoint);
        currentPoint = null;
      } else if (name === "extensions") {
        inExtensions = false;
      }
      currentElement = "";
    });

    parser.on("end", () => {
      // Set start/end times from points
      if (route.points.length > 0) {
        route.startTime = route.points[0].time;
        route.endTime = route.points[route.points.length - 1].time;
      }
      resolve(route);
    });

    parser.on("error", (error: Error) => {
      reject(error);
    });

    createReadStream(filePath).pipe(parser);
  });
}

export async function parseGPXRoutes(
  userId: number,
  directoryPath: string
): Promise<ParseStats> {
  logger.startPhase("Parsing GPX Workout Routes");

  const db = getDatabase();
  const stats: ParseStats = {
    routesProcessed: 0,
    linkedToWorkouts: 0,
    errors: [],
  };

  // Get all GPX files
  const files = readdirSync(directoryPath).filter((f) => f.endsWith(".gpx"));
  logger.info(`Found ${files.length} GPX files`);

  const insertRoute = db.prepare(`
    INSERT INTO workout_routes (workout_id, file_path, start_date, end_date)
    VALUES (?, ?, ?, ?)
  `);

  const updateWorkoutHasRoute = db.prepare(`
    UPDATE workouts SET has_route = 1 WHERE id = ?
  `);

  // Find matching workout by datetime overlap
  const findWorkout = db.prepare(`
    SELECT id FROM workouts
    WHERE user_id = ?
      AND datetime(start_date) <= datetime(?, '+5 minutes')
      AND datetime(end_date) >= datetime(?, '-5 minutes')
    ORDER BY start_date DESC
    LIMIT 1
  `);

  for (const file of files) {
    try {
      const filePath = resolve(directoryPath, file);

      // Parse GPX file
      const route = await parseGPXFile(filePath);

      if (!route.startTime) {
        stats.errors.push(`${file}: No timestamps found`);
        continue;
      }

      // Try to find a matching workout
      const workout = findWorkout.get(userId, route.startTime, route.startTime) as
        | { id: number }
        | undefined;

      if (workout) {
        // Link route to workout
        insertRoute.run(workout.id, filePath, route.startTime, route.endTime || null);
        updateWorkoutHasRoute.run(workout.id);
        stats.linkedToWorkouts++;
      } else {
        // Store as unlinked route (workout_id = 0 or null)
        // For now, skip unlinked routes since the schema requires workout_id
        // Could add a separate table for orphan routes if needed
      }

      stats.routesProcessed++;
      logger.progress("GPX routes", stats.routesProcessed, files.length);
    } catch (error) {
      stats.errors.push(`Failed to parse ${file}: ${error}`);
    }
  }

  logger.endPhase(stats.routesProcessed);

  return stats;
}
