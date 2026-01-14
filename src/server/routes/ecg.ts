import { Elysia } from "elysia";
import { getDatabase } from "../../db/client";
import { getAllUsers } from "../../db/queries";
import { Layout } from "../views/layout";

export default new Elysia()
  .get("/:username/ecg", ({ params }) => {
    const username = params.username;
    const db = getDatabase();
    const users = getAllUsers();
    const user = users.find((u) => u.username === username);

    if (!user) {
      return Response.redirect("/");
    }

    // Get all ECG recordings
    const recordings = db
      .query<{
        id: number;
        recorded_date: string;
        classification: string;
        symptoms: string;
        average_heart_rate: number;
        software_version: string;
        device: string;
        sample_rate_hz: number;
      }>(
        `SELECT id, recorded_date, classification, symptoms,
                average_heart_rate, software_version, device, sample_rate_hz
         FROM ecg_recordings
         WHERE user_id = ?
         ORDER BY recorded_date DESC`
      )
      .all(user.id);

    // Get classification stats
    const classificationStats = db
      .query<{ classification: string; count: number }>(
        `SELECT classification, COUNT(*) as count
         FROM ecg_recordings
         WHERE user_id = ?
         GROUP BY classification
         ORDER BY count DESC`
      )
      .all(user.id);

    const content = `
      <h1>ECG Recordings</h1>

      <div class="card-grid">
        <div class="card stat-card">
          <div class="stat-label">Total Recordings</div>
          <div class="stat-value" style="font-size: 2rem;">
            ${recordings.length}
          </div>
        </div>

        ${classificationStats
          .map(
            (stat) => `
          <div class="card stat-card">
            <div class="stat-label">${stat.classification || "Unknown"}</div>
            <div class="stat-value" style="font-size: 2rem;">
              ${stat.count}
            </div>
          </div>
        `
          )
          .join("")}
      </div>

      <div class="card">
        <h2>All Recordings</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Classification</th>
              <th>Device</th>
              <th>Sample Rate</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${recordings
              .map((ecg) => {
                const dateStr = new Date(ecg.recorded_date).toLocaleString();
                const classificationBadge = getClassificationBadge(ecg.classification);
                return `
                <tr>
                  <td class="text-sm">${dateStr}</td>
                  <td>${classificationBadge}</td>
                  <td class="text-muted text-sm">${ecg.device || "-"}</td>
                  <td class="text-muted text-sm">${ecg.sample_rate_hz} Hz</td>
                  <td>
                    <a href="/${username}/ecg/${ecg.id}"
                       class="btn btn-primary"
                       style="padding: 0.25rem 0.75rem; font-size: 0.875rem;">
                      View Waveform
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

    return Layout("Vitals - ECG Recordings", content, username);
  })
  .get("/:username/ecg/:id", ({ params }) => {
    const username = params.username;
    const ecgId = parseInt(params.id);
    const db = getDatabase();
    const users = getAllUsers();
    const user = users.find((u) => u.username === username);

    if (!user) {
      return Response.redirect("/");
    }

    const ecg = db
      .query<{
        id: number;
        recorded_date: string;
        classification: string;
        symptoms: string;
        average_heart_rate: number;
        software_version: string;
        device: string;
        sample_rate_hz: number;
        waveform_json: string;
      }>(
        `SELECT * FROM ecg_recordings WHERE id = ? AND user_id = ?`
      )
      .get(ecgId, user.id);

    if (!ecg) {
      const content = `
        <h1>ECG Not Found</h1>
        <p class="text-muted">ECG recording #${ecgId} not found.</p>
        <a href="/${username}/ecg" class="btn btn-secondary">Back to ECG Recordings</a>
      `;
      return Layout("Vitals - ECG Not Found", content, username);
    }

    const dateStr = new Date(ecg.recorded_date).toLocaleString();
    const classificationBadge = getClassificationBadge(ecg.classification);

    // Parse waveform data
    let waveformData: number[] = [];
    try {
      waveformData = JSON.parse(ecg.waveform_json || "[]");
    } catch {
      waveformData = [];
    }

    // Calculate duration based on sample rate
    // Note: waveform may be decimated (every 4th point)
    const decimationFactor = 4; // Assume decimation was applied
    const actualSampleRate = ecg.sample_rate_hz / decimationFactor;
    const durationSeconds = waveformData.length / actualSampleRate;

    const content = `
      <div style="margin-bottom: 1rem;">
        <a href="/${username}/ecg" class="btn btn-secondary">&larr; Back to ECG Recordings</a>
      </div>

      <h1>ECG Recording</h1>
      <p class="text-muted">${dateStr}</p>

      <div class="card-grid">
        <div class="card stat-card">
          <div class="stat-label">Classification</div>
          <div style="margin-top: 0.5rem;">
            ${classificationBadge}
          </div>
        </div>

        <div class="card stat-card">
          <div class="stat-label">Duration</div>
          <div class="stat-value" style="font-size: 1.5rem;">
            ${durationSeconds.toFixed(1)}s
          </div>
        </div>

        <div class="card stat-card">
          <div class="stat-label">Device</div>
          <div class="stat-value" style="font-size: 1rem;">
            ${ecg.device || "Unknown"}
          </div>
        </div>

        <div class="card stat-card">
          <div class="stat-label">Sample Rate</div>
          <div class="stat-value" style="font-size: 1.25rem;">
            ${ecg.sample_rate_hz} Hz
          </div>
        </div>

        ${ecg.symptoms ? `
        <div class="card stat-card">
          <div class="stat-label">Symptoms</div>
          <div class="stat-value" style="font-size: 1rem;">
            ${ecg.symptoms}
          </div>
        </div>
        ` : ""}
      </div>

      <div class="card">
        <h2>ECG Waveform</h2>
        <p class="text-muted text-sm" style="margin-bottom: 1rem;">
          ${waveformData.length.toLocaleString()} data points (decimated for performance)
        </p>
        <div class="chart-container" style="height: 400px;">
          <canvas id="ecgChart"></canvas>
        </div>
      </div>

      <script>
        const ctx = document.getElementById('ecgChart').getContext('2d');
        const waveformData = ${JSON.stringify(waveformData)};
        const sampleRate = ${actualSampleRate};

        // Generate time labels in milliseconds
        const timeLabels = waveformData.map((_, i) => (i / sampleRate * 1000).toFixed(0));

        new Chart(ctx, {
          type: 'line',
          data: {
            labels: timeLabels,
            datasets: [{
              label: 'ECG (µV)',
              data: waveformData,
              borderColor: 'rgb(220, 38, 38)',
              borderWidth: 1,
              pointRadius: 0,
              tension: 0
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
              legend: {
                display: false
              },
              tooltip: {
                callbacks: {
                  title: (items) => items[0].label + ' ms',
                  label: (item) => item.raw.toFixed(1) + ' µV'
                }
              }
            },
            scales: {
              x: {
                title: {
                  display: true,
                  text: 'Time (ms)'
                },
                ticks: {
                  maxTicksLimit: 10
                }
              },
              y: {
                title: {
                  display: true,
                  text: 'Voltage (µV)'
                }
              }
            }
          }
        });
      </script>
    `;

    return Layout(`Vitals - ECG ${dateStr}`, content, username);
  });

function getClassificationBadge(classification: string | null): string {
  const cls = classification || "Unknown";
  let bgColor = "var(--secondary)";
  let textColor = "white";

  if (cls === "Sinus Rhythm") {
    bgColor = "#22c55e"; // Green
  } else if (cls.includes("Atrial Fibrillation") || cls.includes("AFib")) {
    bgColor = "#ef4444"; // Red
  } else if (cls === "Inconclusive") {
    bgColor = "#f59e0b"; // Amber
  }

  return `<span style="background: ${bgColor}; color: ${textColor}; padding: 0.25rem 0.75rem; border-radius: 4px; font-size: 0.875rem; font-weight: 500;">${cls}</span>`;
}
