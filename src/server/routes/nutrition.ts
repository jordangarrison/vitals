import { Elysia } from "elysia";
import { getDatabase } from "../../db/client";
import { getAllUsers } from "../../db/queries";
import { Layout } from "../views/layout";

export default new Elysia().get("/:username/nutrition", ({ params }) => {
  const username = params.username;
  const db = getDatabase();
  const users = getAllUsers();
  const user = users.find((u) => u.username === username);

  if (!user) {
    return Response.redirect("/");
  }

  // Get nutrition data
  const nutritionData = db
    .query<{
      date: string;
      calories: number;
      protein_g: number;
      carbs_g: number;
      fat_g: number;
    }>(
      `SELECT date, calories, protein_g, carbs_g, fat_g
       FROM nutrition
       WHERE user_id = ?
       ORDER BY date DESC
       LIMIT 30`
    )
    .all(user.id);

  // Get nutrition stats
  const stats = db
    .query<{
      total_days: number;
      avg_calories: number;
      avg_protein: number;
      avg_carbs: number;
      avg_fat: number;
    }>(
      `SELECT
        COUNT(*) as total_days,
        AVG(calories) as avg_calories,
        AVG(protein_g) as avg_protein,
        AVG(carbs_g) as avg_carbs,
        AVG(fat_g) as avg_fat
       FROM nutrition
       WHERE user_id = ?`
    )
    .get(user.id);

  const chartData = nutritionData.reverse();

  const content = `
    <h1>Nutrition</h1>

    <div class="card-grid">
      <div class="card stat-card">
        <div class="stat-label">Days Tracked</div>
        <div class="stat-value" style="font-size: 2rem;">
          ${stats ? stats.total_days : "0"}
        </div>
      </div>

      <div class="card stat-card">
        <div class="stat-label">Avg Calories</div>
        <div class="stat-value" style="font-size: 2rem;">
          ${stats && stats.avg_calories ? Math.round(stats.avg_calories) : "—"}
        </div>
        <div class="stat-date">kcal/day</div>
      </div>

      <div class="card stat-card">
        <div class="stat-label">Avg Protein</div>
        <div class="stat-value" style="font-size: 2rem;">
          ${stats && stats.avg_protein ? Math.round(stats.avg_protein) : "—"}
        </div>
        <div class="stat-date">g/day</div>
      </div>

      <div class="card stat-card">
        <div class="stat-label">Avg Carbs / Fat</div>
        <div class="stat-value" style="font-size: 1.5rem;">
          ${stats && stats.avg_carbs && stats.avg_fat ? `${Math.round(stats.avg_carbs)} / ${Math.round(stats.avg_fat)}` : "—"}
        </div>
        <div class="stat-date">g/day</div>
      </div>
    </div>

    ${
      nutritionData.length > 0
        ? `
      <div class="card">
        <h2>Calorie Trend (Last 30 Days)</h2>
        <div class="chart-container">
          <canvas id="caloriesChart"></canvas>
        </div>
      </div>

      <div class="card">
        <h2>Macronutrients (Last 30 Days)</h2>
        <div class="chart-container">
          <canvas id="macrosChart"></canvas>
        </div>
      </div>

      <div class="card">
        <h2>Recent Nutrition Data</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Calories</th>
              <th>Protein</th>
              <th>Carbs</th>
              <th>Fat</th>
            </tr>
          </thead>
          <tbody>
            ${nutritionData
              .slice(0, 20)
              .map(
                (day) => `
              <tr>
                <td>${new Date(day.date).toLocaleDateString()}</td>
                <td>${day.calories ? Math.round(day.calories) : "—"} kcal</td>
                <td>${day.protein_g ? Math.round(day.protein_g) : "—"} g</td>
                <td>${day.carbs_g ? Math.round(day.carbs_g) : "—"} g</td>
                <td>${day.fat_g ? Math.round(day.fat_g) : "—"} g</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      </div>

      <script>
        const chartData = ${JSON.stringify(chartData)};

        // Calories chart
        const caloriesCtx = document.getElementById('caloriesChart').getContext('2d');
        new Chart(caloriesCtx, {
          type: 'line',
          data: {
            labels: chartData.map(d => new Date(d.date).toLocaleDateString()),
            datasets: [{
              label: 'Calories',
              data: chartData.map(d => d.calories),
              borderColor: 'rgb(59, 130, 246)',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              tension: 0.1
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: false
              }
            }
          }
        });

        // Macros chart
        const macrosCtx = document.getElementById('macrosChart').getContext('2d');
        new Chart(macrosCtx, {
          type: 'line',
          data: {
            labels: chartData.map(d => new Date(d.date).toLocaleDateString()),
            datasets: [{
              label: 'Protein (g)',
              data: chartData.map(d => d.protein_g),
              borderColor: 'rgb(239, 68, 68)',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              tension: 0.1
            }, {
              label: 'Carbs (g)',
              data: chartData.map(d => d.carbs_g),
              borderColor: 'rgb(34, 197, 94)',
              backgroundColor: 'rgba(34, 197, 94, 0.1)',
              tension: 0.1
            }, {
              label: 'Fat (g)',
              data: chartData.map(d => d.fat_g),
              borderColor: 'rgb(245, 158, 11)',
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              tension: 0.1
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: true,
                position: 'top'
              }
            }
          }
        });
      </script>
    `
        : `
      <div class="card text-center">
        <p class="text-muted">No nutrition data available</p>
      </div>
    `
    }
  `;

  return Layout("Vitals - Nutrition", content, username);
});
