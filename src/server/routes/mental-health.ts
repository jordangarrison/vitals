import { Elysia } from "elysia";
import { getDatabase } from "../../db/client";
import { getAllUsers } from "../../db/queries";
import { Layout, ErrorPage } from "../views/layout";

// Color scheme for mental health indicators
const COLORS = {
  hrv: { border: "rgb(147, 51, 234)", bg: "rgba(147, 51, 234, 0.1)" }, // Purple
  sleep: { border: "rgb(59, 130, 246)", bg: "rgba(59, 130, 246, 0.1)" }, // Blue
  mindfulness: { border: "rgb(34, 197, 94)", bg: "rgba(34, 197, 94, 0.1)" }, // Green
  activity: { border: "rgb(251, 146, 60)", bg: "rgba(251, 146, 60, 0.1)" }, // Orange
  rhr: { border: "rgb(236, 72, 153)", bg: "rgba(236, 72, 153, 0.1)" }, // Pink
};

function formatTrend(current: number, previous: number): { text: string; class: string } {
  if (previous === 0) return { text: "—", class: "" };
  const diff = ((current - previous) / previous) * 100;
  if (Math.abs(diff) < 1) return { text: "stable", class: "neutral" };
  const prefix = diff > 0 ? "+" : "";
  return {
    text: `${prefix}${diff.toFixed(0)}%`,
    class: diff > 0 ? "positive" : "negative",
  };
}

function getDateString(daysAgo: number = 0): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split("T")[0];
}

export default new Elysia()
  // Main Mental Health Dashboard
  .get("/:username/mental-health", ({ params }) => {
    const username = params.username;
    const db = getDatabase();
    const users = getAllUsers();
    const user = users.find((u) => u.username === username);

    if (!user) {
      return ErrorPage(
        "User Not Found",
        `No user found with username: ${username}`,
        "/",
        "Back to User Selection"
      );
    }

    const today = getDateString();
    const weekAgo = getDateString(7);
    const monthAgo = getDateString(30);
    const twoWeeksAgo = getDateString(14);

    // HRV data (30 days)
    const hrvData = db
      .query<{ date: string; avg_hrv: number }>(
        `SELECT DATE(start_date) as date, AVG(value) as avg_hrv
         FROM health_metrics
         WHERE user_id = ? AND metric_type = 'heart_rate_variability'
           AND start_date >= ?
         GROUP BY DATE(start_date)
         ORDER BY date`
      )
      .all(user.id, monthAgo);

    // Calculate HRV 7-day moving average
    const hrvWithMA = hrvData.map((d, i) => {
      const window = hrvData.slice(Math.max(0, i - 6), i + 1);
      const ma = window.reduce((sum, p) => sum + p.avg_hrv, 0) / window.length;
      return { ...d, ma };
    });

    // Current vs previous week HRV
    const currentWeekHRV = hrvData
      .filter((d) => d.date >= weekAgo)
      .reduce((sum, d) => sum + d.avg_hrv, 0);
    const currentWeekHRVDays = hrvData.filter((d) => d.date >= weekAgo).length;
    const previousWeekHRV = hrvData
      .filter((d) => d.date >= twoWeeksAgo && d.date < weekAgo)
      .reduce((sum, d) => sum + d.avg_hrv, 0);
    const previousWeekHRVDays = hrvData.filter(
      (d) => d.date >= twoWeeksAgo && d.date < weekAgo
    ).length;
    const avgCurrentHRV = currentWeekHRVDays > 0 ? currentWeekHRV / currentWeekHRVDays : 0;
    const avgPreviousHRV = previousWeekHRVDays > 0 ? previousWeekHRV / previousWeekHRVDays : 0;
    const hrvTrend = formatTrend(avgCurrentHRV, avgPreviousHRV);

    // Sleep data (7 days) - only actual sleep, not in-bed time
    const sleepData = db
      .query<{ date: string; total_hours: number; core: number; deep: number; rem: number }>(
        `SELECT DATE(start_date) as date,
                SUM(duration_hours) as total_hours,
                SUM(CASE WHEN sleep_type = 'AsleepCore' THEN duration_hours ELSE 0 END) as core,
                SUM(CASE WHEN sleep_type = 'AsleepDeep' THEN duration_hours ELSE 0 END) as deep,
                SUM(CASE WHEN sleep_type = 'AsleepREM' THEN duration_hours ELSE 0 END) as rem
         FROM sleep_sessions
         WHERE user_id = ?
           AND sleep_type IN ('AsleepCore', 'AsleepDeep', 'AsleepREM', 'Asleep')
           AND start_date >= ?
         GROUP BY DATE(start_date)
         ORDER BY date`
      )
      .all(user.id, weekAgo);

    // Calculate average sleep
    const avgSleep =
      sleepData.length > 0
        ? sleepData.reduce((sum, d) => sum + d.total_hours, 0) / sleepData.length
        : 0;

    // Sleep consistency (standard deviation of sleep hours)
    const sleepMean = avgSleep;
    const sleepVariance =
      sleepData.length > 0
        ? sleepData.reduce((sum, d) => sum + Math.pow(d.total_hours - sleepMean, 2), 0) /
          sleepData.length
        : 0;
    const sleepConsistency = Math.max(0, 100 - Math.sqrt(sleepVariance) * 20); // Higher = more consistent

    // Mindfulness data (7 days)
    const mindfulnessData = db
      .query<{ date: string; total_minutes: number; sessions: number }>(
        `SELECT DATE(start_date) as date,
                SUM(value) as total_minutes,
                COUNT(*) as sessions
         FROM health_metrics
         WHERE user_id = ? AND metric_type = 'mindful_session'
           AND start_date >= ?
         GROUP BY DATE(start_date)
         ORDER BY date`
      )
      .all(user.id, weekAgo);

    const totalMindfulMinutes = mindfulnessData.reduce((sum, d) => sum + d.total_minutes, 0);
    const totalMindfulSessions = mindfulnessData.reduce((sum, d) => sum + d.sessions, 0);

    // Resting heart rate (30 days for trend)
    const rhrData = db
      .query<{ date: string; avg_rhr: number }>(
        `SELECT DATE(start_date) as date, AVG(value) as avg_rhr
         FROM health_metrics
         WHERE user_id = ? AND metric_type = 'resting_heart_rate'
           AND start_date >= ?
         GROUP BY DATE(start_date)
         ORDER BY date`
      )
      .all(user.id, monthAgo);

    const latestRHR = rhrData.length > 0 ? rhrData[rhrData.length - 1].avg_rhr : 0;
    const avgRHR =
      rhrData.length > 0 ? rhrData.reduce((sum, d) => sum + d.avg_rhr, 0) / rhrData.length : 0;

    // Activity data (7 days)
    const activityData = db
      .query<{ date: string; exercise_time_minutes: number; active_energy_burned: number }>(
        `SELECT date,
                COALESCE(exercise_time_minutes, 0) as exercise_time_minutes,
                COALESCE(active_energy_burned, 0) as active_energy_burned
         FROM activity_summaries
         WHERE user_id = ? AND date >= ?
         ORDER BY date`
      )
      .all(user.id, weekAgo);

    const totalExerciseMinutes = activityData.reduce(
      (sum, d) => sum + d.exercise_time_minutes,
      0
    );

    // For correlation scatter plot: sleep vs next-day HRV
    const correlationData: { sleep: number; hrv: number; date: string }[] = [];
    for (let i = 0; i < sleepData.length; i++) {
      const sleepDate = sleepData[i].date;
      // Find HRV from the next day
      const nextDay = new Date(sleepDate);
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDayStr = nextDay.toISOString().split("T")[0];
      const hrvRecord = hrvData.find((h) => h.date === nextDayStr);
      if (hrvRecord) {
        correlationData.push({
          sleep: sleepData[i].total_hours,
          hrv: hrvRecord.avg_hrv,
          date: sleepDate,
        });
      }
    }

    const content = `
      <h1>Mental Health Dashboard</h1>

      <p class="text-muted mb-2">
        Track your mental wellness through sleep, stress indicators, mindfulness, and activity.
      </p>

      <!-- Quick Navigation -->
      <div style="display: flex; gap: 1rem; margin-bottom: 2rem;">
        <a href="/${username}/mental-health/day/${today}" class="btn btn-secondary">
          View Today's Timeline
        </a>
        <a href="/${username}/mental-health/week/${weekAgo}" class="btn btn-secondary">
          View Weekly Report
        </a>
      </div>

      <!-- Summary Cards -->
      <div class="card-grid">
        <div class="card stat-card">
          <div class="stat-label">HRV Average</div>
          <div class="stat-value" style="color: ${COLORS.hrv.border};">
            ${avgCurrentHRV.toFixed(0)}
          </div>
          <div class="stat-date">
            ms SDNN
            <span class="${hrvTrend.class}" style="margin-left: 0.5rem;">
              ${hrvTrend.text} vs last week
            </span>
          </div>
        </div>

        <div class="card stat-card">
          <div class="stat-label">Avg Sleep</div>
          <div class="stat-value" style="color: ${COLORS.sleep.border};">
            ${avgSleep.toFixed(1)}
          </div>
          <div class="stat-date">
            hours/night • ${sleepConsistency.toFixed(0)}% consistency
          </div>
        </div>

        <div class="card stat-card">
          <div class="stat-label">Mindfulness</div>
          <div class="stat-value" style="color: ${COLORS.mindfulness.border};">
            ${totalMindfulMinutes.toFixed(0)}
          </div>
          <div class="stat-date">
            minutes this week • ${totalMindfulSessions} sessions
          </div>
        </div>

        <div class="card stat-card">
          <div class="stat-label">Exercise</div>
          <div class="stat-value" style="color: ${COLORS.activity.border};">
            ${totalExerciseMinutes}
          </div>
          <div class="stat-date">
            minutes this week
          </div>
        </div>

        <div class="card stat-card">
          <div class="stat-label">Resting HR</div>
          <div class="stat-value" style="color: ${COLORS.rhr.border};">
            ${latestRHR.toFixed(0)}
          </div>
          <div class="stat-date">
            bpm • ${avgRHR.toFixed(0)} avg (30d)
          </div>
        </div>
      </div>

      <!-- Charts Grid -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 2rem;">
        <!-- HRV Trend Chart -->
        <div class="card">
          <h2>Heart Rate Variability (30 days)</h2>
          <p class="text-muted text-sm mb-1">Higher HRV indicates better stress resilience</p>
          <div class="chart-container">
            <canvas id="hrvChart"></canvas>
          </div>
        </div>

        <!-- Sleep Chart -->
        <div class="card">
          <h2>Sleep Duration (7 days)</h2>
          <p class="text-muted text-sm mb-1">Stacked by sleep stage</p>
          <div class="chart-container">
            <canvas id="sleepChart"></canvas>
          </div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 2rem;">
        <!-- Mindfulness Chart -->
        <div class="card">
          <h2>Mindfulness Sessions (7 days)</h2>
          <div class="chart-container">
            <canvas id="mindfulnessChart"></canvas>
          </div>
        </div>

        <!-- Sleep vs HRV Correlation -->
        <div class="card">
          <h2>Sleep vs Next-Day HRV</h2>
          <p class="text-muted text-sm mb-1">Shows how sleep affects recovery</p>
          <div class="chart-container">
            <canvas id="correlationChart"></canvas>
          </div>
        </div>
      </div>

      <!-- RHR and Activity Combined -->
      <div class="card" style="margin-bottom: 2rem;">
        <h2>Resting Heart Rate Trend (30 days)</h2>
        <p class="text-muted text-sm mb-1">Lower resting heart rate indicates better cardiovascular fitness</p>
        <div class="chart-container">
          <canvas id="rhrChart"></canvas>
        </div>
      </div>

      <style>
        .positive { color: var(--success); font-weight: 500; }
        .negative { color: var(--danger); font-weight: 500; }
        .neutral { color: var(--gray-500); }
      </style>

      <script>
        // HRV Trend Chart with Moving Average
        const hrvCtx = document.getElementById('hrvChart');
        if (hrvCtx) {
          const hrvData = ${JSON.stringify(hrvWithMA)};
          new Chart(hrvCtx, {
            type: 'line',
            data: {
              labels: hrvData.map(d => new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
              datasets: [
                {
                  label: 'Daily HRV',
                  data: hrvData.map(d => d.avg_hrv.toFixed(1)),
                  borderColor: '${COLORS.hrv.border}',
                  backgroundColor: '${COLORS.hrv.bg}',
                  borderWidth: 1,
                  pointRadius: 2,
                  tension: 0.1
                },
                {
                  label: '7-day Moving Avg',
                  data: hrvData.map(d => d.ma.toFixed(1)),
                  borderColor: '${COLORS.hrv.border}',
                  borderWidth: 2,
                  borderDash: [5, 5],
                  pointRadius: 0,
                  tension: 0.4
                }
              ]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'top' }
              },
              scales: {
                y: {
                  beginAtZero: false,
                  title: { display: true, text: 'HRV (ms)' }
                }
              }
            }
          });
        }

        // Sleep Stacked Bar Chart
        const sleepCtx = document.getElementById('sleepChart');
        if (sleepCtx) {
          const sleepData = ${JSON.stringify(sleepData)};
          new Chart(sleepCtx, {
            type: 'bar',
            data: {
              labels: sleepData.map(d => new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' })),
              datasets: [
                {
                  label: 'Core',
                  data: sleepData.map(d => d.core?.toFixed(1) || 0),
                  backgroundColor: 'rgba(59, 130, 246, 0.8)'
                },
                {
                  label: 'Deep',
                  data: sleepData.map(d => d.deep?.toFixed(1) || 0),
                  backgroundColor: 'rgba(30, 64, 175, 0.8)'
                },
                {
                  label: 'REM',
                  data: sleepData.map(d => d.rem?.toFixed(1) || 0),
                  backgroundColor: 'rgba(139, 92, 246, 0.8)'
                }
              ]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'top' }
              },
              scales: {
                x: { stacked: true },
                y: {
                  stacked: true,
                  title: { display: true, text: 'Hours' },
                  max: 10
                }
              }
            }
          });
        }

        // Mindfulness Bar Chart
        const mindfulCtx = document.getElementById('mindfulnessChart');
        if (mindfulCtx) {
          const mindfulData = ${JSON.stringify(mindfulnessData)};
          new Chart(mindfulCtx, {
            type: 'bar',
            data: {
              labels: mindfulData.map(d => new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' })),
              datasets: [{
                label: 'Minutes',
                data: mindfulData.map(d => d.total_minutes?.toFixed(0) || 0),
                backgroundColor: '${COLORS.mindfulness.bg}',
                borderColor: '${COLORS.mindfulness.border}',
                borderWidth: 1
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false }
              },
              scales: {
                y: {
                  beginAtZero: true,
                  title: { display: true, text: 'Minutes' }
                }
              }
            }
          });
        }

        // Sleep vs HRV Correlation Scatter Plot
        const corrCtx = document.getElementById('correlationChart');
        if (corrCtx) {
          const corrData = ${JSON.stringify(correlationData)};
          new Chart(corrCtx, {
            type: 'scatter',
            data: {
              datasets: [{
                label: 'Sleep vs HRV',
                data: corrData.map(d => ({ x: d.sleep, y: d.hrv })),
                backgroundColor: '${COLORS.hrv.border}',
                pointRadius: 6
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
                      return \`Sleep: \${context.parsed.x.toFixed(1)}h, HRV: \${context.parsed.y.toFixed(0)}ms\`;
                    }
                  }
                }
              },
              scales: {
                x: {
                  title: { display: true, text: 'Sleep (hours)' },
                  min: 4,
                  max: 10
                },
                y: {
                  title: { display: true, text: 'Next-day HRV (ms)' }
                }
              }
            }
          });
        }

        // Resting Heart Rate Trend
        const rhrCtx = document.getElementById('rhrChart');
        if (rhrCtx) {
          const rhrData = ${JSON.stringify(rhrData)};
          new Chart(rhrCtx, {
            type: 'line',
            data: {
              labels: rhrData.map(d => new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
              datasets: [{
                label: 'Resting HR',
                data: rhrData.map(d => d.avg_rhr.toFixed(0)),
                borderColor: '${COLORS.rhr.border}',
                backgroundColor: '${COLORS.rhr.bg}',
                fill: true,
                tension: 0.4
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false }
              },
              scales: {
                y: {
                  beginAtZero: false,
                  title: { display: true, text: 'BPM' }
                }
              }
            }
          });
        }
      </script>
    `;

    return Layout("Vitals - Mental Health", content, username);
  })

  // Daily Timeline View
  .get("/:username/mental-health/day/:date", ({ params }) => {
    const username = params.username;
    const date = params.date;
    const db = getDatabase();
    const users = getAllUsers();
    const user = users.find((u) => u.username === username);

    if (!user) {
      return ErrorPage(
        "User Not Found",
        `No user found with username: ${username}`,
        "/",
        "Back to User Selection"
      );
    }

    // Parse and validate date
    const targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) {
      return ErrorPage(
        "Invalid Date",
        "Please provide a valid date in YYYY-MM-DD format.",
        `/${username}/mental-health`,
        "Back to Mental Health",
        username
      );
    }

    const dateStr = date;
    const prevDate = new Date(targetDate);
    prevDate.setDate(prevDate.getDate() - 1);
    const prevDateStr = prevDate.toISOString().split("T")[0];
    const nextDate = new Date(targetDate);
    nextDate.setDate(nextDate.getDate() + 1);
    const nextDateStr = nextDate.toISOString().split("T")[0];

    // Get sleep from previous night (ending on this date)
    const sleepData = db
      .query<{
        start_date: string;
        end_date: string;
        duration_hours: number;
        sleep_type: string;
        source_name: string;
      }>(
        `SELECT start_date, end_date, duration_hours, sleep_type, source_name
         FROM sleep_sessions
         WHERE user_id = ? AND DATE(end_date) = ?
         ORDER BY start_date`
      )
      .all(user.id, dateStr);

    const totalSleep = sleepData
      .filter((s) => s.sleep_type !== "InBed")
      .reduce((sum, s) => sum + s.duration_hours, 0);

    // Get HRV readings for the day
    const hrvReadings = db
      .query<{ start_date: string; value: number; source_name: string }>(
        `SELECT start_date, value, source_name
         FROM health_metrics
         WHERE user_id = ? AND metric_type = 'heart_rate_variability'
           AND DATE(start_date) = ?
         ORDER BY start_date`
      )
      .all(user.id, dateStr);

    const avgHRV =
      hrvReadings.length > 0
        ? hrvReadings.reduce((sum, r) => sum + r.value, 0) / hrvReadings.length
        : 0;

    // Get resting heart rate
    const rhrReading = db
      .query<{ value: number; start_date: string }>(
        `SELECT value, start_date
         FROM health_metrics
         WHERE user_id = ? AND metric_type = 'resting_heart_rate'
           AND DATE(start_date) = ?
         ORDER BY start_date DESC
         LIMIT 1`
      )
      .get(user.id, dateStr);

    // Get mindfulness sessions
    const mindfulSessions = db
      .query<{ start_date: string; end_date: string; value: number; source_name: string }>(
        `SELECT start_date, end_date, value, source_name
         FROM health_metrics
         WHERE user_id = ? AND metric_type = 'mindful_session'
           AND DATE(start_date) = ?
         ORDER BY start_date`
      )
      .all(user.id, dateStr);

    const totalMindful = mindfulSessions.reduce((sum, s) => sum + s.value, 0);

    // Get activity summary
    const activity = db
      .query<{
        exercise_time_minutes: number;
        active_energy_burned: number;
        stand_hours: number;
      }>(
        `SELECT exercise_time_minutes, active_energy_burned, stand_hours
         FROM activity_summaries
         WHERE user_id = ? AND date = ?`
      )
      .get(user.id, dateStr);

    const displayDate = targetDate.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const content = `
      <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem;">
        <a href="/${username}/mental-health/day/${prevDateStr}" class="btn btn-secondary">
          &larr; Previous
        </a>
        <h1 style="margin: 0; flex: 1; text-align: center;">${displayDate}</h1>
        <a href="/${username}/mental-health/day/${nextDateStr}" class="btn btn-secondary">
          Next &rarr;
        </a>
      </div>

      <div style="margin-bottom: 1rem;">
        <a href="/${username}/mental-health" class="btn btn-secondary">
          &larr; Back to Dashboard
        </a>
      </div>

      <!-- Summary Cards -->
      <div class="card-grid">
        <div class="card stat-card">
          <div class="stat-label">Sleep</div>
          <div class="stat-value">${totalSleep.toFixed(1)}</div>
          <div class="stat-date">hours</div>
        </div>

        <div class="card stat-card">
          <div class="stat-label">HRV</div>
          <div class="stat-value">${avgHRV.toFixed(0)}</div>
          <div class="stat-date">ms avg (${hrvReadings.length} readings)</div>
        </div>

        <div class="card stat-card">
          <div class="stat-label">Resting HR</div>
          <div class="stat-value">${rhrReading ? rhrReading.value.toFixed(0) : "—"}</div>
          <div class="stat-date">bpm</div>
        </div>

        <div class="card stat-card">
          <div class="stat-label">Mindfulness</div>
          <div class="stat-value">${totalMindful.toFixed(0)}</div>
          <div class="stat-date">minutes (${mindfulSessions.length} sessions)</div>
        </div>

        <div class="card stat-card">
          <div class="stat-label">Exercise</div>
          <div class="stat-value">${activity?.exercise_time_minutes || 0}</div>
          <div class="stat-date">minutes</div>
        </div>
      </div>

      <!-- Sleep Breakdown -->
      <div class="card" style="margin-bottom: 1.5rem;">
        <h2>Sleep Breakdown (Previous Night)</h2>
        ${
          sleepData.length > 0
            ? `
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Start</th>
                <th>End</th>
                <th>Duration</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              ${sleepData
                .map(
                  (s) => `
                <tr>
                  <td style="text-transform: capitalize;">
                    ${s.sleep_type.replace("Asleep", "").replace("InBed", "In Bed") || "Sleep"}
                  </td>
                  <td>${new Date(s.start_date).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</td>
                  <td>${new Date(s.end_date).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</td>
                  <td>${s.duration_hours.toFixed(1)} hrs</td>
                  <td class="text-muted text-sm">${s.source_name}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        `
            : '<p class="text-muted">No sleep data recorded</p>'
        }
      </div>

      <!-- HRV Throughout Day -->
      <div class="card" style="margin-bottom: 1.5rem;">
        <h2>HRV Throughout Day</h2>
        ${
          hrvReadings.length > 0
            ? `
          <div class="chart-container">
            <canvas id="dayHrvChart"></canvas>
          </div>
        `
            : '<p class="text-muted">No HRV readings recorded</p>'
        }
      </div>

      <!-- Mindfulness Sessions -->
      <div class="card" style="margin-bottom: 1.5rem;">
        <h2>Mindfulness Sessions</h2>
        ${
          mindfulSessions.length > 0
            ? `
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Duration</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              ${mindfulSessions
                .map(
                  (s) => `
                <tr>
                  <td>${new Date(s.start_date).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</td>
                  <td>${s.value.toFixed(0)} minutes</td>
                  <td class="text-muted text-sm">${s.source_name}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        `
            : '<p class="text-muted">No mindfulness sessions recorded</p>'
        }
      </div>

      <script>
        ${
          hrvReadings.length > 0
            ? `
          const dayHrvCtx = document.getElementById('dayHrvChart');
          if (dayHrvCtx) {
            const hrvData = ${JSON.stringify(hrvReadings)};
            new Chart(dayHrvCtx, {
              type: 'line',
              data: {
                labels: hrvData.map(d => new Date(d.start_date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })),
                datasets: [{
                  label: 'HRV',
                  data: hrvData.map(d => d.value),
                  borderColor: 'rgb(147, 51, 234)',
                  backgroundColor: 'rgba(147, 51, 234, 0.1)',
                  fill: true,
                  tension: 0.3
                }]
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false }
                },
                scales: {
                  y: {
                    beginAtZero: false,
                    title: { display: true, text: 'HRV (ms)' }
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

    return Layout(`Vitals - ${displayDate}`, content, username);
  })

  // Weekly Report View
  .get("/:username/mental-health/week/:date", ({ params }) => {
    const username = params.username;
    const date = params.date;
    const db = getDatabase();
    const users = getAllUsers();
    const user = users.find((u) => u.username === username);

    if (!user) {
      return ErrorPage(
        "User Not Found",
        `No user found with username: ${username}`,
        "/",
        "Back to User Selection"
      );
    }

    // Parse and validate date (start of week)
    const weekStart = new Date(date);
    if (isNaN(weekStart.getTime())) {
      return ErrorPage(
        "Invalid Date",
        "Please provide a valid date in YYYY-MM-DD format.",
        `/${username}/mental-health`,
        "Back to Mental Health",
        username
      );
    }

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekStartStr = date;
    const weekEndStr = weekEnd.toISOString().split("T")[0];

    // Previous week dates
    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);
    const prevWeekStartStr = prevWeekStart.toISOString().split("T")[0];
    const prevWeekEnd = new Date(weekStart);
    prevWeekEnd.setDate(prevWeekEnd.getDate() - 1);
    const prevWeekEndStr = prevWeekEnd.toISOString().split("T")[0];

    // Next week date
    const nextWeekStart = new Date(weekStart);
    nextWeekStart.setDate(nextWeekStart.getDate() + 7);
    const nextWeekStartStr = nextWeekStart.toISOString().split("T")[0];

    // Current week data
    const currentWeekHRV = db
      .query<{ avg_hrv: number; count: number }>(
        `SELECT AVG(value) as avg_hrv, COUNT(*) as count
         FROM health_metrics
         WHERE user_id = ? AND metric_type = 'heart_rate_variability'
           AND DATE(start_date) >= ? AND DATE(start_date) <= ?`
      )
      .get(user.id, weekStartStr, weekEndStr);

    const currentWeekSleep = db
      .query<{ avg_sleep: number; total_nights: number }>(
        `SELECT AVG(daily_total) as avg_sleep, COUNT(*) as total_nights
         FROM (
           SELECT DATE(start_date) as date, SUM(duration_hours) as daily_total
           FROM sleep_sessions
           WHERE user_id = ?
             AND sleep_type IN ('AsleepCore', 'AsleepDeep', 'AsleepREM', 'Asleep')
             AND DATE(start_date) >= ? AND DATE(start_date) <= ?
           GROUP BY DATE(start_date)
         )`
      )
      .get(user.id, weekStartStr, weekEndStr);

    const currentWeekMindful = db
      .query<{ total_minutes: number; total_sessions: number }>(
        `SELECT SUM(value) as total_minutes, COUNT(*) as total_sessions
         FROM health_metrics
         WHERE user_id = ? AND metric_type = 'mindful_session'
           AND DATE(start_date) >= ? AND DATE(start_date) <= ?`
      )
      .get(user.id, weekStartStr, weekEndStr);

    const currentWeekExercise = db
      .query<{ total_minutes: number }>(
        `SELECT SUM(exercise_time_minutes) as total_minutes
         FROM activity_summaries
         WHERE user_id = ? AND date >= ? AND date <= ?`
      )
      .get(user.id, weekStartStr, weekEndStr);

    // Previous week data for comparison
    const prevWeekHRV = db
      .query<{ avg_hrv: number }>(
        `SELECT AVG(value) as avg_hrv
         FROM health_metrics
         WHERE user_id = ? AND metric_type = 'heart_rate_variability'
           AND DATE(start_date) >= ? AND DATE(start_date) <= ?`
      )
      .get(user.id, prevWeekStartStr, prevWeekEndStr);

    const prevWeekSleep = db
      .query<{ avg_sleep: number }>(
        `SELECT AVG(daily_total) as avg_sleep
         FROM (
           SELECT DATE(start_date) as date, SUM(duration_hours) as daily_total
           FROM sleep_sessions
           WHERE user_id = ?
             AND sleep_type IN ('AsleepCore', 'AsleepDeep', 'AsleepREM', 'Asleep')
             AND DATE(start_date) >= ? AND DATE(start_date) <= ?
           GROUP BY DATE(start_date)
         )`
      )
      .get(user.id, prevWeekStartStr, prevWeekEndStr);

    const prevWeekMindful = db
      .query<{ total_minutes: number }>(
        `SELECT SUM(value) as total_minutes
         FROM health_metrics
         WHERE user_id = ? AND metric_type = 'mindful_session'
           AND DATE(start_date) >= ? AND DATE(start_date) <= ?`
      )
      .get(user.id, prevWeekStartStr, prevWeekEndStr);

    const prevWeekExercise = db
      .query<{ total_minutes: number }>(
        `SELECT SUM(exercise_time_minutes) as total_minutes
         FROM activity_summaries
         WHERE user_id = ? AND date >= ? AND date <= ?`
      )
      .get(user.id, prevWeekStartStr, prevWeekEndStr);

    // Calculate trends
    const hrvTrend = formatTrend(
      currentWeekHRV?.avg_hrv || 0,
      prevWeekHRV?.avg_hrv || 0
    );
    const sleepTrend = formatTrend(
      currentWeekSleep?.avg_sleep || 0,
      prevWeekSleep?.avg_sleep || 0
    );
    const mindfulTrend = formatTrend(
      currentWeekMindful?.total_minutes || 0,
      prevWeekMindful?.total_minutes || 0
    );
    const exerciseTrend = formatTrend(
      currentWeekExercise?.total_minutes || 0,
      prevWeekExercise?.total_minutes || 0
    );

    // Daily breakdown for charts
    const dailyData = db
      .query<{
        date: string;
        hrv: number;
        sleep: number;
        mindful: number;
        exercise: number;
      }>(
        `WITH dates AS (
           SELECT DATE(?, '+' || n || ' days') as date
           FROM (SELECT 0 as n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6)
         ),
         hrv_data AS (
           SELECT DATE(start_date) as date, AVG(value) as hrv
           FROM health_metrics
           WHERE user_id = ? AND metric_type = 'heart_rate_variability'
             AND DATE(start_date) >= ? AND DATE(start_date) <= ?
           GROUP BY DATE(start_date)
         ),
         sleep_data AS (
           SELECT DATE(start_date) as date, SUM(duration_hours) as sleep
           FROM sleep_sessions
           WHERE user_id = ?
             AND sleep_type IN ('AsleepCore', 'AsleepDeep', 'AsleepREM', 'Asleep')
             AND DATE(start_date) >= ? AND DATE(start_date) <= ?
           GROUP BY DATE(start_date)
         ),
         mindful_data AS (
           SELECT DATE(start_date) as date, SUM(value) as mindful
           FROM health_metrics
           WHERE user_id = ? AND metric_type = 'mindful_session'
             AND DATE(start_date) >= ? AND DATE(start_date) <= ?
           GROUP BY DATE(start_date)
         ),
         exercise_data AS (
           SELECT date, exercise_time_minutes as exercise
           FROM activity_summaries
           WHERE user_id = ? AND date >= ? AND date <= ?
         )
         SELECT
           d.date,
           COALESCE(h.hrv, 0) as hrv,
           COALESCE(s.sleep, 0) as sleep,
           COALESCE(m.mindful, 0) as mindful,
           COALESCE(e.exercise, 0) as exercise
         FROM dates d
         LEFT JOIN hrv_data h ON d.date = h.date
         LEFT JOIN sleep_data s ON d.date = s.date
         LEFT JOIN mindful_data m ON d.date = m.date
         LEFT JOIN exercise_data e ON d.date = e.date
         ORDER BY d.date`
      )
      .all(
        weekStartStr,
        user.id,
        weekStartStr,
        weekEndStr,
        user.id,
        weekStartStr,
        weekEndStr,
        user.id,
        weekStartStr,
        weekEndStr,
        user.id,
        weekStartStr,
        weekEndStr
      );

    // Find best/worst days
    const bestHRVDay = [...dailyData].filter((d) => d.hrv > 0).sort((a, b) => b.hrv - a.hrv)[0];
    const bestSleepDay = [...dailyData].filter((d) => d.sleep > 0).sort((a, b) => b.sleep - a.sleep)[0];

    const displayWeekRange = `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

    const content = `
      <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem;">
        <a href="/${username}/mental-health/week/${prevWeekStartStr}" class="btn btn-secondary">
          &larr; Previous Week
        </a>
        <h1 style="margin: 0; flex: 1; text-align: center;">Week of ${displayWeekRange}</h1>
        <a href="/${username}/mental-health/week/${nextWeekStartStr}" class="btn btn-secondary">
          Next Week &rarr;
        </a>
      </div>

      <div style="margin-bottom: 1rem;">
        <a href="/${username}/mental-health" class="btn btn-secondary">
          &larr; Back to Dashboard
        </a>
      </div>

      <!-- Week-over-Week Comparison -->
      <div class="card-grid">
        <div class="card stat-card">
          <div class="stat-label">Avg HRV</div>
          <div class="stat-value">${(currentWeekHRV?.avg_hrv || 0).toFixed(0)}</div>
          <div class="stat-date">
            ms
            <span class="${hrvTrend.class}" style="margin-left: 0.5rem;">
              ${hrvTrend.text}
            </span>
          </div>
        </div>

        <div class="card stat-card">
          <div class="stat-label">Avg Sleep</div>
          <div class="stat-value">${(currentWeekSleep?.avg_sleep || 0).toFixed(1)}</div>
          <div class="stat-date">
            hours/night
            <span class="${sleepTrend.class}" style="margin-left: 0.5rem;">
              ${sleepTrend.text}
            </span>
          </div>
        </div>

        <div class="card stat-card">
          <div class="stat-label">Mindfulness</div>
          <div class="stat-value">${(currentWeekMindful?.total_minutes || 0).toFixed(0)}</div>
          <div class="stat-date">
            total minutes
            <span class="${mindfulTrend.class}" style="margin-left: 0.5rem;">
              ${mindfulTrend.text}
            </span>
          </div>
        </div>

        <div class="card stat-card">
          <div class="stat-label">Exercise</div>
          <div class="stat-value">${currentWeekExercise?.total_minutes || 0}</div>
          <div class="stat-date">
            total minutes
            <span class="${exerciseTrend.class}" style="margin-left: 0.5rem;">
              ${exerciseTrend.text}
            </span>
          </div>
        </div>
      </div>

      <!-- Highlights -->
      <div class="card" style="margin-bottom: 1.5rem;">
        <h2>Week Highlights</h2>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          ${
            bestHRVDay
              ? `
            <div>
              <strong>Best HRV Day:</strong>
              ${new Date(bestHRVDay.date).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
              (${bestHRVDay.hrv.toFixed(0)} ms)
            </div>
          `
              : ""
          }
          ${
            bestSleepDay
              ? `
            <div>
              <strong>Best Sleep:</strong>
              ${new Date(bestSleepDay.date).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
              (${bestSleepDay.sleep.toFixed(1)} hrs)
            </div>
          `
              : ""
          }
        </div>
      </div>

      <!-- Daily Breakdown Chart -->
      <div class="card" style="margin-bottom: 1.5rem;">
        <h2>Daily Breakdown</h2>
        <div class="chart-container" style="height: 350px;">
          <canvas id="weeklyChart"></canvas>
        </div>
      </div>

      <!-- Daily Table -->
      <div class="card">
        <h2>Day-by-Day</h2>
        <table>
          <thead>
            <tr>
              <th>Day</th>
              <th>HRV</th>
              <th>Sleep</th>
              <th>Mindfulness</th>
              <th>Exercise</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${dailyData
              .map(
                (d) => `
              <tr>
                <td>
                  ${new Date(d.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                </td>
                <td>${d.hrv > 0 ? d.hrv.toFixed(0) + " ms" : "—"}</td>
                <td>${d.sleep > 0 ? d.sleep.toFixed(1) + " hrs" : "—"}</td>
                <td>${d.mindful > 0 ? d.mindful.toFixed(0) + " min" : "—"}</td>
                <td>${d.exercise > 0 ? d.exercise + " min" : "—"}</td>
                <td>
                  <a href="/${username}/mental-health/day/${d.date}" class="btn btn-secondary" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">
                    Details
                  </a>
                </td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      </div>

      <style>
        .positive { color: var(--success); font-weight: 500; }
        .negative { color: var(--danger); font-weight: 500; }
        .neutral { color: var(--gray-500); }
      </style>

      <script>
        const weeklyCtx = document.getElementById('weeklyChart');
        if (weeklyCtx) {
          const dailyData = ${JSON.stringify(dailyData)};
          new Chart(weeklyCtx, {
            type: 'bar',
            data: {
              labels: dailyData.map(d => new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' })),
              datasets: [
                {
                  label: 'HRV (ms)',
                  data: dailyData.map(d => d.hrv || null),
                  backgroundColor: 'rgba(147, 51, 234, 0.8)',
                  yAxisID: 'y'
                },
                {
                  label: 'Sleep (hrs)',
                  data: dailyData.map(d => d.sleep || null),
                  backgroundColor: 'rgba(59, 130, 246, 0.8)',
                  yAxisID: 'y1'
                },
                {
                  label: 'Exercise (min)',
                  data: dailyData.map(d => d.exercise || null),
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
                legend: { position: 'top' }
              },
              scales: {
                y: {
                  type: 'linear',
                  display: true,
                  position: 'left',
                  title: { display: true, text: 'HRV (ms)' }
                },
                y1: {
                  type: 'linear',
                  display: true,
                  position: 'right',
                  title: { display: true, text: 'Sleep (hrs)' },
                  grid: { drawOnChartArea: false },
                  max: 10
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
      </script>
    `;

    return Layout(`Vitals - Week of ${displayWeekRange}`, content, username);
  });
