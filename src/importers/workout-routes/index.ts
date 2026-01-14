import { existsSync } from "fs";
import { resolve } from "path";
import { parseGPXRoutes } from "./gpx-parser";
import { logger } from "../../utils/logger";
import type { ImportResult } from "../../types/health";

export interface WorkoutRoutesImportOptions {
  userId: number;
  username: string;
  dataPath?: string;
}

export async function importWorkoutRoutes(
  options: WorkoutRoutesImportOptions
): Promise<ImportResult> {
  const { userId, username, dataPath } = options;
  const basePath = dataPath || resolve(process.cwd(), "health-data");
  const routesPath = resolve(
    basePath,
    username,
    "apple-health",
    "workout-routes"
  );

  logger.info(`\nImporting Workout Routes...`);

  if (!existsSync(routesPath)) {
    logger.warn(`Workout routes directory not found: ${routesPath}`);
    return {
      success: true,
      recordsImported: 0,
      errors: [],
      warnings: [`Workout routes directory not found`],
      timeTaken: 0,
    };
  }

  const startTime = Date.now();

  try {
    const stats = await parseGPXRoutes(userId, routesPath);
    const timeTaken = (Date.now() - startTime) / 1000;

    logger.success(
      `Imported ${stats.routesProcessed.toLocaleString()} workout routes (${stats.linkedToWorkouts} linked to workouts)`
    );

    return {
      success: stats.errors.length === 0,
      recordsImported: stats.routesProcessed,
      errors: stats.errors,
      warnings: [],
      timeTaken,
    };
  } catch (error) {
    logger.error(`Workout routes import failed: ${error}`);
    return {
      success: false,
      recordsImported: 0,
      errors: [String(error)],
      warnings: [],
      timeTaken: (Date.now() - startTime) / 1000,
    };
  }
}
