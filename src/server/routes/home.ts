import { Elysia } from "elysia";
import { getDatabase } from "../../db/client";
import { getAllUsers } from "../../db/queries";
import { Layout } from "../views/layout";
import { formatWeight } from "../../utils/display-units";

export default new Elysia()
  .get("/", () => {
    const users = getAllUsers();

    if (users.length === 0) {
      return Layout(
        "Vitals - Welcome",
        `
        <div class="card text-center">
          <h2>Welcome to Vitals</h2>
          <p class="text-muted mt-2">
            No data imported yet. Run the import command to get started:
          </p>
          <pre class="mt-2">bun run import --user &lt;username&gt;</pre>
        </div>
      `
      );
    }

    const content = `
      <h1>Select User</h1>

      <div class="card">
        <p class="text-muted mb-2">
          Choose a user to view their health data:
        </p>

        <div class="card-grid">
          ${users
            .map(
              (user) => `
            <a href="/${user.username}" class="card stat-card" style="text-decoration: none; cursor: pointer; transition: transform 0.2s;">
              <div class="stat-label">${user.display_name}</div>
              <div style="font-size: 1.2rem; color: var(--gray-600); margin-top: 0.5rem;">
                @${user.username}
              </div>
              <div class="mt-2">
                <span class="btn btn-primary">View Dashboard</span>
              </div>
            </a>
          `
            )
            .join("")}
        </div>
      </div>
    `;

    return Layout("Vitals - Select User", content);
  })
  .get("/:username", ({ params }) => {
    const username = params.username;
    const db = getDatabase();
    const users = getAllUsers();
    const user = users.find((u) => u.username === username);

    if (!user) {
      return Layout(
        "Vitals - User Not Found",
        `
        <div class="card text-center">
          <h2>User Not Found</h2>
          <p class="text-muted mt-2">
            No user found with username: ${username}
          </p>
          <a href="/" class="btn btn-primary mt-2">Back to User Selection</a>
        </div>
      `
      );
    }

    // Get data coverage and timeline
    const dataCoverage = db
      .query<{
        min_date: string;
        max_date: string;
        total_records: number;
        total_days: number;
      }>(
        `SELECT
           MIN(start_date) as min_date,
           MAX(start_date) as max_date,
           COUNT(*) as total_records,
           CAST((julianday(MAX(start_date)) - julianday(MIN(start_date))) AS INTEGER) as total_days
         FROM health_metrics
         WHERE user_id = ?`
      )
      .get(user.id);

    // Get lifetime workout statistics
    const workoutStats = db
      .query<{
        total_workouts: number;
        total_distance_km: number;
        total_energy_kcal: number;
        total_minutes: number;
      }>(
        `SELECT
           COUNT(*) as total_workouts,
           SUM(total_distance_km) as total_distance_km,
           SUM(total_energy_kcal) as total_energy_kcal,
           SUM(duration_minutes) as total_minutes
         FROM workouts
         WHERE user_id = ?`
      )
      .get(user.id);

    // Get weight journey statistics
    const weightStats = db
      .query<{
        avg_weight: number;
        min_weight: number;
        max_weight: number;
        weight_records: number;
      }>(
        `SELECT
           AVG(value) as avg_weight,
           MIN(value) as min_weight,
           MAX(value) as max_weight,
           COUNT(*) as weight_records
         FROM health_metrics
         WHERE user_id = ? AND metric_type = 'weight'`
      )
      .get(user.id);

    // Get activity summary statistics
    const activityStats = db
      .query<{
        total_days: number;
        avg_active_energy: number;
        avg_exercise_minutes: number;
      }>(
        `SELECT
           COUNT(*) as total_days,
           AVG(active_energy_burned) as avg_active_energy,
           AVG(exercise_time_minutes) as avg_exercise_minutes
         FROM activity_summaries
         WHERE user_id = ?`
      )
      .get(user.id);

    // Get peak workout achievements
    const peakWorkout = db
      .query<{
        activity_type: string;
        duration_minutes: number;
        total_distance_km: number;
        start_date: string;
      }>(
        `SELECT activity_type, duration_minutes, total_distance_km, start_date
         FROM workouts
         WHERE user_id = ? AND total_distance_km IS NOT NULL
         ORDER BY total_distance_km DESC LIMIT 1`
      )
      .get(user.id);

    // Get total unique metric types tracked
    const metricCount = db
      .query<{ count: number }>(
        `SELECT COUNT(DISTINCT metric_type) as count FROM health_metrics WHERE user_id = ?`
      )
      .get(user.id);

    // Get workout breakdown by activity type
    const workoutBreakdown = db
      .query<{
        activity_type: string;
        count: number;
        total_distance_km: number;
        total_energy_kcal: number;
      }>(
        `SELECT
           activity_type,
           COUNT(*) as count,
           SUM(total_distance_km) as total_distance_km,
           SUM(total_energy_kcal) as total_energy_kcal
         FROM workouts
         WHERE user_id = ?
         GROUP BY activity_type
         ORDER BY count DESC
         LIMIT 10`
      )
      .all(user.id);

    // Get metric types with date ranges
    const metricTypes = db
      .query<{
        metric_type: string;
        count: number;
        min_date: string;
        max_date: string;
      }>(
        `SELECT
           metric_type,
           COUNT(*) as count,
           MIN(start_date) as min_date,
           MAX(start_date) as max_date
         FROM health_metrics
         WHERE user_id = ?
         GROUP BY metric_type
         ORDER BY count DESC
         LIMIT 8`
      )
      .all(user.id);

    // Get monthly weight trend data
    const weightTrend = db
      .query<{ month: string; avg_weight: number; count: number }>(
        `SELECT
           strftime('%Y-%m', start_date) as month,
           AVG(value) as avg_weight,
           COUNT(*) as count
         FROM health_metrics
         WHERE user_id = ? AND metric_type = 'weight' AND start_date >= '2000-01-01'
         GROUP BY strftime('%Y-%m', start_date)
         ORDER BY month`
      )
      .all(user.id);

    // Get monthly activity trend data
    const activityTrend = db
      .query<{
        month: string;
        avg_active_energy: number;
        total_workouts: number;
      }>(
        `SELECT
           strftime('%Y-%m', date) as month,
           AVG(active_energy_burned) as avg_active_energy,
           COUNT(*) as total_workouts
         FROM activity_summaries
         WHERE user_id = ? AND date >= '2000-01-01'
         GROUP BY strftime('%Y-%m', date)
         ORDER BY month`
      )
      .all(user.id);

    // Get year-over-year workout comparison
    const yoyWorkouts = db
      .query<{
        year: string;
        total_workouts: number;
        total_distance_km: number;
        total_energy_kcal: number;
      }>(
        `SELECT
           strftime('%Y', start_date) as year,
           COUNT(*) as total_workouts,
           SUM(total_distance_km) as total_distance_km,
           SUM(total_energy_kcal) as total_energy_kcal
         FROM workouts
         WHERE user_id = ? AND start_date >= '2000-01-01'
         GROUP BY strftime('%Y', start_date)
         ORDER BY year`
      )
      .all(user.id);

    // Calculate years of data
    const yearsOfData =
      dataCoverage && dataCoverage.total_days
        ? (dataCoverage.total_days / 365.25).toFixed(1)
        : "0";

    const content = `
      <h1>Health Journey - ${user.display_name}</h1>

      ${
        dataCoverage
          ? `
      <div class="card" style="margin-bottom: 2rem; background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%); color: white;">
        <h2 style="margin-top: 0; color: white;">${yearsOfData} Years of Health Data</h2>
        <p style="font-size: 1.1rem; opacity: 0.95; margin-bottom: 0;">
          ${new Date(dataCoverage.min_date).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
          —
          ${new Date(dataCoverage.max_date).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
          <span style="opacity: 0.8; margin-left: 1rem;">•</span>
          ${dataCoverage.total_records.toLocaleString()} records tracked
        </p>
      </div>
      `
          : ""
      }

      <div class="card-grid">
        ${
          workoutStats
            ? `
        <div class="card stat-card">
          <div class="stat-label">Total Workouts</div>
          <div class="stat-value">
            ${workoutStats.total_workouts.toLocaleString()}
          </div>
          <div class="stat-date">
            ${((workoutStats.total_minutes || 0) / 60).toFixed(0)} hours • ${((workoutStats.total_distance_km || 0) * 0.621371).toFixed(0)} miles
          </div>
        </div>
        `
            : ""
        }

        ${
          workoutStats && workoutStats.total_energy_kcal
            ? `
        <div class="card stat-card">
          <div class="stat-label">Energy Burned</div>
          <div class="stat-value">
            ${(workoutStats.total_energy_kcal / 1000).toFixed(1)}k
          </div>
          <div class="stat-date">
            ${workoutStats.total_energy_kcal.toLocaleString()} kcal total
          </div>
        </div>
        `
            : ""
        }

        ${
          weightStats && weightStats.weight_records > 0
            ? `
        <div class="card stat-card">
          <div class="stat-label">Weight Journey</div>
          <div class="stat-value">
            ${formatWeight(weightStats.avg_weight).split(" ")[0]}
          </div>
          <div class="stat-date">
            avg • ${formatWeight(weightStats.min_weight)} min • ${formatWeight(weightStats.max_weight)} max
          </div>
        </div>
        `
            : ""
        }

        ${
          activityStats && activityStats.total_days
            ? `
        <div class="card stat-card">
          <div class="stat-label">Active Days</div>
          <div class="stat-value">
            ${activityStats.total_days.toLocaleString()}
          </div>
          <div class="stat-date">
            ${Math.round(activityStats.avg_exercise_minutes || 0)} min avg exercise
          </div>
        </div>
        `
            : ""
        }

        ${
          metricCount
            ? `
        <div class="card stat-card">
          <div class="stat-label">Health Metrics</div>
          <div class="stat-value">
            ${metricCount.count}
          </div>
          <div class="stat-date">
            unique data types tracked
          </div>
        </div>
        `
            : ""
        }

        ${
          peakWorkout
            ? `
        <div class="card stat-card">
          <div class="stat-label">Longest ${peakWorkout.activity_type}</div>
          <div class="stat-value">
            ${((peakWorkout.total_distance_km || 0) * 0.621371).toFixed(1)} mi
          </div>
          <div class="stat-date">
            ${new Date(peakWorkout.start_date).toLocaleDateString()} • ${Math.round(peakWorkout.duration_minutes || 0)} min
          </div>
        </div>
        `
            : ""
        }
      </div>

      <!-- Long-term Trend Charts -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 2rem;">
        ${
          weightTrend.length > 0
            ? `
        <div class="card">
          <h2>Weight Trend</h2>
          <canvas id="weightChart" style="max-height: 300px;"></canvas>
        </div>
        `
            : ""
        }

        ${
          activityTrend.length > 0
            ? `
        <div class="card">
          <h2>Activity Trend</h2>
          <canvas id="activityChart" style="max-height: 300px;"></canvas>
        </div>
        `
            : ""
        }
      </div>

      <!-- Year-over-Year Comparison -->
      ${
        yoyWorkouts.length > 1
          ? `
      <div class="card" style="margin-bottom: 2rem;">
        <h2>Year-over-Year Workout Comparison</h2>
        <canvas id="yoyChart" style="max-height: 300px;"></canvas>
      </div>
      `
          : ""
      }

      <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1.5rem; margin-bottom: 2rem;">
        <div class="card">
          <h2>Workout Breakdown</h2>
          ${
            workoutBreakdown.length > 0
              ? `
            <table>
              <thead>
                <tr>
                  <th>Activity</th>
                  <th>Count</th>
                  <th>Distance</th>
                  <th>Calories</th>
                </tr>
              </thead>
              <tbody>
                ${workoutBreakdown
                  .map(
                    (workout) => `
                  <tr>
                    <td style="text-transform: capitalize;">
                      ${workout.activity_type.replace(/_/g, " ")}
                    </td>
                    <td>${workout.count.toLocaleString()}</td>
                    <td>${workout.total_distance_km ? `${((workout.total_distance_km || 0) * 0.621371).toFixed(0)} mi` : "—"}</td>
                    <td>${workout.total_energy_kcal ? `${(workout.total_energy_kcal / 1000).toFixed(1)}k` : "—"}</td>
                  </tr>
                `
                  )
                  .join("")}
              </tbody>
            </table>
          `
              : '<p class="text-muted text-center mt-2">No workouts recorded</p>'
          }
          <div class="mt-2">
            <a href="/${username}/workouts" class="btn btn-secondary">View All Workouts</a>
          </div>
        </div>

        <div class="card">
          <h2>Data Coverage</h2>
          <table>
            <tbody>
              ${metricTypes
                .map((metric) => {
                  const years = metric.min_date && metric.max_date
                    ? ((new Date(metric.max_date).getTime() - new Date(metric.min_date).getTime()) / (1000 * 60 * 60 * 24 * 365.25)).toFixed(1)
                    : "0";
                  return `
                <tr>
                  <td style="text-transform: capitalize;">
                    ${metric.metric_type.replace(/_/g, " ")}
                  </td>
                  <td class="text-muted text-sm" style="text-align: right;">
                    ${years}y • ${(metric.count / 1000).toFixed(0)}k
                  </td>
                </tr>
              `;
                })
                .join("")}
            </tbody>
          </table>
          <div class="mt-2">
            <a href="/${username}/metrics" class="btn btn-secondary">View All Metrics</a>
          </div>
        </div>
      </div>

      <script>
        ${
          weightTrend.length > 0
            ? `
        // Weight Trend Chart
        const weightCtx = document.getElementById('weightChart');
        if (weightCtx) {
          new Chart(weightCtx, {
            type: 'line',
            data: {
              labels: ${JSON.stringify(weightTrend.map((d) => d.month))},
              datasets: [{
                label: 'Weight (lbs)',
                data: ${JSON.stringify(weightTrend.map((d) => (d.avg_weight * 2.20462).toFixed(1)))},
                borderColor: 'rgb(99, 102, 241)',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                tension: 0.4,
                fill: true
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label: function(context) {
                      return context.parsed.y + ' lbs';
                    }
                  }
                }
              },
              scales: {
                y: {
                  beginAtZero: false,
                  ticks: {
                    callback: function(value) {
                      return value + ' lbs';
                    }
                  }
                },
                x: {
                  ticks: {
                    maxRotation: 45,
                    minRotation: 45,
                    autoSkip: true,
                    maxTicksLimit: 20
                  }
                }
              }
            }
          });
        }
        `
            : ""
        }

        ${
          activityTrend.length > 0
            ? `
        // Activity Trend Chart
        const activityCtx = document.getElementById('activityChart');
        if (activityCtx) {
          new Chart(activityCtx, {
            type: 'line',
            data: {
              labels: ${JSON.stringify(activityTrend.map((d) => d.month))},
              datasets: [{
                label: 'Avg Active Energy (kcal/day)',
                data: ${JSON.stringify(activityTrend.map((d) => Math.round(d.avg_active_energy || 0)))},
                borderColor: 'rgb(34, 197, 94)',
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                tension: 0.4,
                fill: true
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label: function(context) {
                      return context.parsed.y + ' kcal/day';
                    }
                  }
                }
              },
              scales: {
                y: {
                  beginAtZero: true,
                  ticks: {
                    callback: function(value) {
                      return value + ' kcal';
                    }
                  }
                },
                x: {
                  ticks: {
                    maxRotation: 45,
                    minRotation: 45,
                    autoSkip: true,
                    maxTicksLimit: 20
                  }
                }
              }
            }
          });
        }
        `
            : ""
        }

        ${
          yoyWorkouts.length > 1
            ? `
        // Year-over-Year Comparison Chart
        const yoyCtx = document.getElementById('yoyChart');
        if (yoyCtx) {
          new Chart(yoyCtx, {
            type: 'bar',
            data: {
              labels: ${JSON.stringify(yoyWorkouts.map((d) => d.year))},
              datasets: [
                {
                  label: 'Workouts',
                  data: ${JSON.stringify(yoyWorkouts.map((d) => d.total_workouts))},
                  backgroundColor: 'rgba(99, 102, 241, 0.8)',
                  yAxisID: 'y'
                },
                {
                  label: 'Distance (miles)',
                  data: ${JSON.stringify(yoyWorkouts.map((d) => Math.round((d.total_distance_km || 0) * 0.621371)))},
                  backgroundColor: 'rgba(34, 197, 94, 0.8)',
                  yAxisID: 'y1'
                },
                {
                  label: 'Energy (kcal × 100)',
                  data: ${JSON.stringify(yoyWorkouts.map((d) => Math.round((d.total_energy_kcal || 0) / 100)))},
                  backgroundColor: 'rgba(251, 146, 60, 0.8)',
                  yAxisID: 'y2'
                }
              ]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              interaction: {
                mode: 'index',
                intersect: false
              },
              plugins: {
                legend: { position: 'top' },
                tooltip: {
                  callbacks: {
                    label: function(context) {
                      let label = context.dataset.label || '';
                      if (label) {
                        label += ': ';
                      }
                      if (context.dataset.label === 'Energy (kcal × 100)') {
                        label += (context.parsed.y * 100).toLocaleString() + ' kcal';
                      } else {
                        label += context.parsed.y.toLocaleString();
                      }
                      return label;
                    }
                  }
                }
              },
              scales: {
                y: {
                  type: 'linear',
                  display: true,
                  position: 'left',
                  title: { display: true, text: 'Workouts' }
                },
                y1: {
                  type: 'linear',
                  display: true,
                  position: 'right',
                  title: { display: true, text: 'Distance (miles)' },
                  grid: { drawOnChartArea: false }
                },
                y2: {
                  type: 'linear',
                  display: false,
                  position: 'right'
                }
              }
            }
          });
        }
        `
            : ""
        }
      </script>
    `;

    return Layout("Vitals - Dashboard", content, username);
  });
