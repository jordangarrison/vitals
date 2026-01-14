import { Elysia } from "elysia";
import { readFileSync } from "fs";
import sax from "sax";
import { createReadStream } from "fs";
import { getDatabase } from "../../db/client";
import { getAllUsers } from "../../db/queries";
import { LayoutWithMap } from "../views/layout";

interface TrackPoint {
  lat: number;
  lon: number;
  ele?: number;
  time?: string;
  speed?: number;
}

function parseGPXForDisplay(filePath: string): Promise<TrackPoint[]> {
  return new Promise((resolve, reject) => {
    const parser = sax.createStream(true, { trim: true });
    const points: TrackPoint[] = [];
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
      if (!currentPoint) return;

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
        points.push(currentPoint);
        currentPoint = null;
      } else if (name === "extensions") {
        inExtensions = false;
      }
      currentElement = "";
    });

    parser.on("end", () => {
      resolve(points);
    });

    parser.on("error", (error: Error) => {
      reject(error);
    });

    createReadStream(filePath).pipe(parser);
  });
}

export default new Elysia()
  .get("/:username/routes", ({ params }) => {
    const username = params.username;
    const db = getDatabase();
    const users = getAllUsers();
    const user = users.find((u) => u.username === username);

    if (!user) {
      return Response.redirect("/");
    }

    // Get all workout routes with workout info
    const routes = db
      .query<{
        id: number;
        workout_id: number;
        file_path: string;
        start_date: string;
        end_date: string;
        activity_type: string;
        duration_minutes: number;
        total_distance_km: number;
      }>(
        `SELECT wr.id, wr.workout_id, wr.file_path, wr.start_date, wr.end_date,
                w.activity_type, w.duration_minutes, w.total_distance_km
         FROM workout_routes wr
         JOIN workouts w ON wr.workout_id = w.id
         WHERE w.user_id = ?
         ORDER BY wr.start_date DESC`
      )
      .all(user.id);

    const content = `
      <h1>Workout Routes</h1>

      <div class="card-grid">
        <div class="card stat-card">
          <div class="stat-label">Total Routes</div>
          <div class="stat-value" style="font-size: 2rem;">
            ${routes.length}
          </div>
        </div>
      </div>

      <div class="card">
        <h2>All Routes</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Activity</th>
              <th>Duration</th>
              <th>Distance</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${routes
              .map((route) => {
                const dateStr = new Date(route.start_date).toLocaleString();
                const duration = route.duration_minutes
                  ? `${Math.floor(route.duration_minutes)}m`
                  : "-";
                const distance = route.total_distance_km
                  ? `${(route.total_distance_km * 0.621371).toFixed(2)} mi`
                  : "-";
                return `
                <tr>
                  <td class="text-sm">${dateStr}</td>
                  <td style="text-transform: capitalize;">${route.activity_type}</td>
                  <td class="text-muted">${duration}</td>
                  <td class="text-muted">${distance}</td>
                  <td>
                    <a href="/${username}/workouts/${route.workout_id}/route"
                       class="btn btn-primary"
                       style="padding: 0.25rem 0.75rem; font-size: 0.875rem;">
                      View Map
                    </a>
                  </td>
                </tr>
              `;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    `;

    return LayoutWithMap("Vitals - Workout Routes", content, username);
  })
  .get("/:username/workouts/:id/route", async ({ params }) => {
    const username = params.username;
    const workoutId = parseInt(params.id);
    const db = getDatabase();
    const users = getAllUsers();
    const user = users.find((u) => u.username === username);

    if (!user) {
      return Response.redirect("/");
    }

    // Get workout and route info
    const workout = db
      .query<{
        id: number;
        activity_type: string;
        start_date: string;
        end_date: string;
        duration_minutes: number;
        total_distance_km: number;
        total_energy_kcal: number;
      }>(
        `SELECT * FROM workouts WHERE id = ? AND user_id = ?`
      )
      .get(workoutId, user.id);

    if (!workout) {
      const content = `
        <h1>Workout Not Found</h1>
        <p class="text-muted">Workout #${workoutId} not found.</p>
        <a href="/${username}/workouts" class="btn btn-secondary">Back to Workouts</a>
      `;
      return LayoutWithMap("Vitals - Workout Not Found", content, username);
    }

    const route = db
      .query<{ id: number; file_path: string; start_date: string; end_date: string }>(
        `SELECT * FROM workout_routes WHERE workout_id = ?`
      )
      .get(workoutId);

    if (!route) {
      const content = `
        <h1>Route Not Found</h1>
        <p class="text-muted">No route data available for this workout.</p>
        <a href="/${username}/workouts" class="btn btn-secondary">Back to Workouts</a>
      `;
      return LayoutWithMap("Vitals - Route Not Found", content, username);
    }

    // Parse GPX file for display
    let trackPoints: TrackPoint[] = [];
    try {
      trackPoints = await parseGPXForDisplay(route.file_path);
    } catch (error) {
      const content = `
        <h1>Error Loading Route</h1>
        <p class="text-muted">Failed to load route data: ${error}</p>
        <a href="/${username}/workouts" class="btn btn-secondary">Back to Workouts</a>
      `;
      return LayoutWithMap("Vitals - Route Error", content, username);
    }

    // Decimate points for performance (every 5th point for routes with many points)
    const decimationFactor = trackPoints.length > 1000 ? 5 : 1;
    const displayPoints = trackPoints.filter((_, i) => i % decimationFactor === 0);

    const dateStr = new Date(workout.start_date).toLocaleString();
    const duration = workout.duration_minutes
      ? `${Math.floor(workout.duration_minutes / 60)}h ${Math.floor(workout.duration_minutes % 60)}m`
      : "-";
    const distance = workout.total_distance_km
      ? `${(workout.total_distance_km * 0.621371).toFixed(2)} mi`
      : "-";

    // Calculate center and bounds
    const lats = displayPoints.map((p) => p.lat);
    const lons = displayPoints.map((p) => p.lon);
    const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const centerLon = (Math.min(...lons) + Math.max(...lons)) / 2;

    // Prepare elevation data for chart
    const elevationData = displayPoints
      .filter((p) => p.ele !== undefined)
      .map((p, i) => ({
        distance: i,
        elevation: p.ele! * 3.28084, // Convert to feet
      }));

    const content = `
      <div style="margin-bottom: 1rem;">
        <a href="/${username}/workouts" class="btn btn-secondary">&larr; Back to Workouts</a>
      </div>

      <h1 style="text-transform: capitalize;">${workout.activity_type} Route</h1>
      <p class="text-muted">${dateStr}</p>

      <div class="card-grid">
        <div class="card stat-card">
          <div class="stat-label">Duration</div>
          <div class="stat-value" style="font-size: 1.5rem;">
            ${duration}
          </div>
        </div>

        <div class="card stat-card">
          <div class="stat-label">Distance</div>
          <div class="stat-value" style="font-size: 1.5rem;">
            ${distance}
          </div>
        </div>

        ${workout.total_energy_kcal ? `
        <div class="card stat-card">
          <div class="stat-label">Calories</div>
          <div class="stat-value" style="font-size: 1.5rem;">
            ${workout.total_energy_kcal.toFixed(0)}
          </div>
        </div>
        ` : ""}

        <div class="card stat-card">
          <div class="stat-label">Track Points</div>
          <div class="stat-value" style="font-size: 1.5rem;">
            ${trackPoints.length.toLocaleString()}
          </div>
        </div>
      </div>

      <div class="card">
        <h2>Route Map</h2>
        <div id="map" style="height: 500px; border-radius: 8px;"></div>
      </div>

      ${elevationData.length > 0 ? `
      <div class="card">
        <h2>Elevation Profile</h2>
        <div class="chart-container" style="height: 200px;">
          <canvas id="elevationChart"></canvas>
        </div>
      </div>
      ` : ""}

      <script>
        // Initialize map
        const routeData = ${JSON.stringify(displayPoints.map((p) => [p.lat, p.lon]))};
        const map = L.map('map').setView([${centerLat}, ${centerLon}], 14);

        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        // Add route polyline
        const polyline = L.polyline(routeData, {
          color: '#3b82f6',
          weight: 4,
          opacity: 0.8
        }).addTo(map);

        // Fit map to route bounds
        map.fitBounds(polyline.getBounds(), { padding: [20, 20] });

        // Add start/end markers
        if (routeData.length > 0) {
          L.marker(routeData[0], {
            icon: L.divIcon({
              className: 'custom-marker',
              html: '<div style="background: #22c55e; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>',
              iconSize: [12, 12]
            })
          }).addTo(map).bindPopup('Start');

          L.marker(routeData[routeData.length - 1], {
            icon: L.divIcon({
              className: 'custom-marker',
              html: '<div style="background: #ef4444; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>',
              iconSize: [12, 12]
            })
          }).addTo(map).bindPopup('End');
        }

        ${elevationData.length > 0 ? `
        // Elevation chart
        const elevationCtx = document.getElementById('elevationChart').getContext('2d');
        const elevationData = ${JSON.stringify(elevationData)};

        new Chart(elevationCtx, {
          type: 'line',
          data: {
            labels: elevationData.map((_, i) => i),
            datasets: [{
              label: 'Elevation (ft)',
              data: elevationData.map(d => d.elevation),
              borderColor: 'rgb(34, 197, 94)',
              backgroundColor: 'rgba(34, 197, 94, 0.1)',
              fill: true,
              tension: 0.1,
              pointRadius: 0
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false }
            },
            scales: {
              x: { display: false },
              y: {
                title: { display: true, text: 'Elevation (ft)' }
              }
            }
          }
        });
        ` : ""}
      </script>
    `;

    return LayoutWithMap(`Vitals - ${workout.activity_type} Route`, content, username);
  });
