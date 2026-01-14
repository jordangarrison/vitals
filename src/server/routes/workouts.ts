import { Elysia, t } from "elysia";
import { getDatabase } from "../../db/client";
import { getAllUsers } from "../../db/queries";
import { Layout } from "../views/layout";
import { formatDistance } from "../../utils/display-units";

const PAGE_SIZE = 50;

function paginationControls(
  basePath: string,
  currentPage: number,
  totalPages: number,
  totalRecords: number
): string {
  if (totalPages <= 1) return "";

  const pages: string[] = [];
  const maxVisible = 5;
  let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let end = Math.min(totalPages, start + maxVisible - 1);

  if (end - start < maxVisible - 1) {
    start = Math.max(1, end - maxVisible + 1);
  }

  // Previous button
  if (currentPage > 1) {
    pages.push(
      `<a href="${basePath}?page=${currentPage - 1}" class="btn btn-secondary" style="padding: 0.25rem 0.5rem;">← Prev</a>`
    );
  }

  // Page numbers
  if (start > 1) {
    pages.push(
      `<a href="${basePath}?page=1" class="btn btn-secondary" style="padding: 0.25rem 0.5rem;">1</a>`
    );
    if (start > 2) pages.push(`<span style="padding: 0 0.5rem;">...</span>`);
  }

  for (let i = start; i <= end; i++) {
    if (i === currentPage) {
      pages.push(
        `<span class="btn btn-primary" style="padding: 0.25rem 0.5rem;">${i}</span>`
      );
    } else {
      pages.push(
        `<a href="${basePath}?page=${i}" class="btn btn-secondary" style="padding: 0.25rem 0.5rem;">${i}</a>`
      );
    }
  }

  if (end < totalPages) {
    if (end < totalPages - 1) pages.push(`<span style="padding: 0 0.5rem;">...</span>`);
    pages.push(
      `<a href="${basePath}?page=${totalPages}" class="btn btn-secondary" style="padding: 0.25rem 0.5rem;">${totalPages}</a>`
    );
  }

  // Next button
  if (currentPage < totalPages) {
    pages.push(
      `<a href="${basePath}?page=${currentPage + 1}" class="btn btn-secondary" style="padding: 0.25rem 0.5rem;">Next →</a>`
    );
  }

  return `
    <div style="display: flex; align-items: center; justify-content: center; gap: 0.5rem; margin-top: 1rem;">
      ${pages.join("")}
      <span class="text-muted text-sm" style="margin-left: 1rem;">
        ${totalRecords.toLocaleString()} total
      </span>
    </div>
  `;
}

export default new Elysia().get(
  "/:username/workouts",
  ({ params, query }) => {
    const username = params.username;
    const page = Math.max(1, parseInt(query.page || "1", 10));
    const db = getDatabase();
    const users = getAllUsers();
    const user = users.find((u) => u.username === username);

    if (!user) {
      return Response.redirect("/");
    }

    // Get total count for pagination
    const countResult = db
      .query<{ count: number }>(
        `SELECT COUNT(*) as count FROM workouts WHERE user_id = ?`
      )
      .get(user.id);
    const totalRecords = countResult?.count || 0;
    const totalPages = Math.ceil(totalRecords / PAGE_SIZE);
    const offset = (page - 1) * PAGE_SIZE;

    // Get workouts for current page
    const workouts = db
      .query<{
        id: number;
        activity_type: string;
        start_date: string;
        duration_minutes: number;
        total_distance_km: number;
        total_energy_kcal: number;
        source_name: string;
        has_route: number;
      }>(
        `SELECT id, activity_type, start_date, duration_minutes,
                total_distance_km, total_energy_kcal, source_name, has_route
         FROM workouts
         WHERE user_id = ?
         ORDER BY start_date DESC
         LIMIT ? OFFSET ?`
      )
      .all(user.id, PAGE_SIZE, offset);

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
        <h2>Workouts</h2>
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
                <th></th>
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
                  <td>
                    ${workout.has_route ? `<a href="/${username}/workouts/${workout.id}/route" class="btn btn-primary" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">View Route</a>` : ""}
                  </td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
          ${paginationControls(`/${username}/workouts`, page, totalPages, totalRecords)}
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
