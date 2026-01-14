import { Elysia } from "elysia";
import { getDatabase } from "../../db/client";
import { getAllUsers } from "../../db/queries";
import { Layout } from "../views/layout";
import { convertToImperial } from "../../utils/display-units";

export default new Elysia()
  .get("/:username/metrics", ({ params }) => {
    const username = params.username;
    const db = getDatabase();
    const users = getAllUsers();
    const user = users.find((u) => u.username === username);

    if (!user) {
      return Response.redirect("/");
    }

    // Get all metric types with stats
    const metrics = db
      .query<{
        metric_type: string;
        count: number;
        min_date: string;
        max_date: string;
        avg_value: number;
        unit: string;
      }>(
        `SELECT
          metric_type,
          COUNT(*) as count,
          MIN(start_date) as min_date,
          MAX(start_date) as max_date,
          AVG(value) as avg_value,
          unit
         FROM health_metrics
         WHERE user_id = ?
         GROUP BY metric_type
         ORDER BY count DESC`
      )
      .all(user.id);

    const content = `
      <h1>Health Metrics</h1>

      <div class="card">
        <p class="text-muted mb-2">
          Explore ${metrics.length} different health metrics tracked from ${user.display_name}'s data.
        </p>

        <table>
          <thead>
            <tr>
              <th>Metric</th>
              <th>Records</th>
              <th>Date Range</th>
              <th>Average</th>
              <th>Unit</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${metrics
              .map((metric) => {
                const converted = convertToImperial(
                  metric.avg_value,
                  metric.metric_type,
                  metric.unit
                );
                return `
              <tr>
                <td style="text-transform: capitalize; font-weight: 500;">
                  ${metric.metric_type.replace(/_/g, " ")}
                </td>
                <td>${metric.count.toLocaleString()}</td>
                <td class="text-sm text-muted">
                  ${new Date(metric.min_date).toLocaleDateString()} → ${new Date(metric.max_date).toLocaleDateString()}
                </td>
                <td>${converted.value.toFixed(1)}</td>
                <td class="text-muted text-sm">${converted.unit}</td>
                <td>
                  <a
                    href="/${username}/metrics/${metric.metric_type}"
                    class="btn btn-primary"
                    style="padding: 0.25rem 0.75rem; font-size: 0.875rem;"
                  >
                    View
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

    return Layout("Vitals - Metrics", content, username);
  })
  .get("/:username/metrics/:metricType", ({ params }) => {
    const username = params.username;
    const metricType = params.metricType;
    const db = getDatabase();
    const users = getAllUsers();
    const user = users.find((u) => u.username === username);

    if (!user) {
      return Response.redirect("/");
    }

    // Get metric stats
    const stats = db
      .query<{
        count: number;
        min_value: number;
        max_value: number;
        avg_value: number;
        unit: string;
        min_date: string;
        max_date: string;
      }>(
        `SELECT
          COUNT(*) as count,
          MIN(value) as min_value,
          MAX(value) as max_value,
          AVG(value) as avg_value,
          unit,
          MIN(start_date) as min_date,
          MAX(start_date) as max_date
         FROM health_metrics
         WHERE user_id = ? AND metric_type = ?`
      )
      .get(user.id, metricType);

    if (!stats || stats.count === 0) {
      const content = `
        <h1>Metric Not Found</h1>
        <p class="text-muted">
          No data found for metric type: ${metricType}
        </p>
        <a href="/${username}/metrics" class="btn btn-secondary mt-2">
          Back to Metrics
        </a>
      `;
      return Layout(`Vitals - ${metricType}`, content, username);
    }

    // Get recent data points (last 30 days or 100 records, whichever is less)
    const recentData = db
      .query<{ value: number; start_date: string; source_name: string }>(
        `SELECT value, start_date, source_name
         FROM health_metrics
         WHERE user_id = ? AND metric_type = ?
         ORDER BY start_date DESC
         LIMIT 100`
      )
      .all(user.id, metricType);

    // Prepare data for chart (reverse to show chronologically)
    const chartData = recentData.reverse();

    // Convert stats to imperial
    const convertedAvg = convertToImperial(stats.avg_value, metricType, stats.unit);
    const convertedMin = convertToImperial(stats.min_value, metricType, stats.unit);
    const convertedMax = convertToImperial(stats.max_value, metricType, stats.unit);
    const displayUnit = convertedAvg.unit;

    const content = `
      <div style="margin-bottom: 1rem;">
        <a href="/${username}/metrics" class="btn btn-secondary">← Back to Metrics</a>
      </div>

      <h1 style="text-transform: capitalize;">
        ${metricType.replace(/_/g, " ")}
      </h1>

      <div class="card-grid">
        <div class="card stat-card">
          <div class="stat-label">Total Records</div>
          <div class="stat-value" style="font-size: 2rem;">
            ${stats.count.toLocaleString()}
          </div>
        </div>

        <div class="card stat-card">
          <div class="stat-label">Average</div>
          <div class="stat-value" style="font-size: 2rem;">
            ${convertedAvg.value.toFixed(1)}
          </div>
          <div class="stat-date">${displayUnit}</div>
        </div>

        <div class="card stat-card">
          <div class="stat-label">Min / Max</div>
          <div class="stat-value" style="font-size: 1.5rem;">
            ${convertedMin.value.toFixed(1)} / ${convertedMax.value.toFixed(1)}
          </div>
          <div class="stat-date">${displayUnit}</div>
        </div>

        <div class="card stat-card">
          <div class="stat-label">Date Range</div>
          <div class="stat-date" style="margin-top: 1rem; font-size: 0.875rem;">
            ${new Date(stats.min_date).toLocaleDateString()}
          </div>
          <div class="stat-date">↓</div>
          <div class="stat-date" style="font-size: 0.875rem;">
            ${new Date(stats.max_date).toLocaleDateString()}
          </div>
        </div>
      </div>

      <div class="card">
        <h2>Recent Values (Last 100 records)</h2>
        <div class="chart-container">
          <canvas id="metricChart"></canvas>
        </div>
      </div>

      <div class="card">
        <h2>Recent Data</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Value</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            ${recentData
              .slice(0, 20)
              .map((record) => {
                const converted = convertToImperial(record.value, metricType, stats.unit);
                return `
              <tr>
                <td>
                  ${new Date(record.start_date).toLocaleString("en-US", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </td>
                <td>
                  ${converted.value.toFixed(2)} ${displayUnit}
                </td>
                <td class="text-muted text-sm">${record.source_name}</td>
              </tr>
            `;
              })
              .join("")}
          </tbody>
        </table>
      </div>

      <script>
        const ctx = document.getElementById('metricChart').getContext('2d');
        const chartData = ${JSON.stringify(
          chartData.map((d) => {
            const converted = convertToImperial(d.value, metricType, stats.unit);
            return { ...d, value: converted.value };
          })
        )};

        new Chart(ctx, {
          type: 'line',
          data: {
            labels: chartData.map(d => new Date(d.start_date).toLocaleDateString()),
            datasets: [{
              label: '${metricType.replace(/_/g, " ")} (${displayUnit})',
              data: chartData.map(d => d.value),
              borderColor: 'rgb(59, 130, 246)',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              tension: 0.1,
              pointRadius: chartData.length > 50 ? 0 : 3,
              borderWidth: chartData.length > 50 ? 1 : 2
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: chartData.length > 100 ? false : { duration: 400 },
            plugins: {
              legend: {
                display: false
              },
              decimation: {
                enabled: chartData.length > 100,
                algorithm: 'lttb',
                samples: 100
              }
            },
            scales: {
              x: {
                ticks: {
                  maxTicksLimit: 10
                }
              },
              y: {
                beginAtZero: false
              }
            }
          }
        });
      </script>
    `;

    return Layout(`Vitals - ${metricType}`, content, username);
  });
