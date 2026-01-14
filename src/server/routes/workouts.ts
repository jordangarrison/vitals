import { Elysia } from "elysia";
import { getDatabase } from "../../db/client";
import { getAllUsers } from "../../db/queries";
import { Layout } from "../views/layout";
import { formatDistance } from "../../utils/display-units";

export default new Elysia().get("/:username/workouts", ({ params }) => {
  const username = params.username;
  const db = getDatabase();
  const users = getAllUsers();
  const user = users.find((u) => u.username === username);

  if (!user) {
    return Response.redirect("/");
  }

  // Get all workouts
  const workouts = db
    .query<{
      id: number;
      activity_type: string;
      start_date: string;
      duration_minutes: number;
      total_distance_km: number;
      total_energy_kcal: number;
      source_name: string;
    }>(
      `SELECT id, activity_type, start_date, duration_minutes,
              total_distance_km, total_energy_kcal, source_name
       FROM workouts
       WHERE user_id = ?
       ORDER BY start_date DESC
       LIMIT 100`
    )
    .all(user.id);

  // Get workout stats
  const stats = db
    .query<{
      total_workouts: number;
      total_duration: number;
      total_calories: number;
      total_distance: number;
    }>(
      `SELECT
        COUNT(*) as total_workouts,
        SUM(duration_minutes) as total_duration,
        SUM(total_energy_kcal) as total_calories,
        SUM(total_distance_km) as total_distance
       FROM workouts
       WHERE user_id = ?`
    )
    .get(user.id);

  // Get activity type breakdown
  const activityBreakdown = db
    .query<{ activity_type: string; count: number }>(
      `SELECT activity_type, COUNT(*) as count
       FROM workouts
       WHERE user_id = ?
       GROUP BY activity_type
       ORDER BY count DESC
       LIMIT 10`
    )
    .all(user.id);

  const content = `
    <h1>Workouts</h1>

    <div class="card-grid">
      <div class="card stat-card">
        <div class="stat-label">Total Workouts</div>
        <div class="stat-value" style="font-size: 2rem;">
          ${stats ? stats.total_workouts.toLocaleString() : "0"}
        </div>
      </div>

      <div class="card stat-card">
        <div class="stat-label">Total Duration</div>
        <div class="stat-value" style="font-size: 2rem;">
          ${stats && stats.total_duration ? Math.round(stats.total_duration / 60) : "0"}
        </div>
        <div class="stat-date">hours</div>
      </div>

      <div class="card stat-card">
        <div class="stat-label">Calories Burned</div>
        <div class="stat-value" style="font-size: 2rem;">
          ${stats && stats.total_calories ? Math.round(stats.total_calories).toLocaleString() : "0"}
        </div>
        <div class="stat-date">kcal</div>
      </div>

      <div class="card stat-card">
        <div class="stat-label">Total Distance</div>
        <div class="stat-value" style="font-size: 2rem;">
          ${stats && stats.total_distance ? Math.round(stats.total_distance * 0.621371) : "0"}
        </div>
        <div class="stat-date">miles</div>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1.5rem;">
      <div class="card">
        <h2>Recent Workouts</h2>
        ${
          workouts.length > 0
            ? `
          <table>
            <thead>
              <tr>
                <th>Activity</th>
                <th>Date</th>
                <th>Duration</th>
                <th>Distance</th>
                <th>Calories</th>
              </tr>
            </thead>
            <tbody>
              ${workouts
                .map(
                  (workout) => `
                <tr>
                  <td style="text-transform: capitalize; font-weight: 500;">
                    ${workout.activity_type.replace(/_/g, " ")}
                  </td>
                  <td class="text-sm">
                    ${new Date(workout.start_date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                  <td>
                    ${workout.duration_minutes ? `${Math.round(workout.duration_minutes)} min` : "—"}
                  </td>
                  <td>
                    ${workout.total_distance_km ? formatDistance(workout.total_distance_km) : "—"}
                  </td>
                  <td>
                    ${workout.total_energy_kcal ? `${Math.round(workout.total_energy_kcal)} kcal` : "—"}
                  </td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        `
            : '<p class="text-muted text-center mt-2">No workouts found</p>'
        }
      </div>

      <div class="card">
        <h2>Activity Types</h2>
        <table>
          <tbody>
            ${activityBreakdown
              .map(
                (activity) => `
              <tr>
                <td style="text-transform: capitalize;">
                  ${activity.activity_type.replace(/_/g, " ")}
                </td>
                <td class="text-muted text-sm" style="text-align: right;">
                  ${activity.count} workouts
                </td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;

  return Layout("Vitals - Workouts", content, username);
});
