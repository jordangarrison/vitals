import { Elysia } from "elysia";
import { html } from "@elysiajs/html";
import { staticPlugin } from "@elysiajs/static";
import home from "./server/routes/home";
import metrics from "./server/routes/metrics";
import workouts from "./server/routes/workouts";
import nutrition from "./server/routes/nutrition";

const app = new Elysia()
  .use(html())
  .use(staticPlugin())
  .use(home)
  .use(metrics)
  .use(workouts)
  .use(nutrition)
  .listen(3000);

console.log(`
╔═══════════════════════════════════════════════════════════╗
║  Vitals - Personal Health Data Explorer                  ║
╚═══════════════════════════════════════════════════════════╝

Server running at: http://localhost:${app.server?.port}

Available routes:
  • http://localhost:${app.server?.port}/          - Dashboard
  • http://localhost:${app.server?.port}/metrics   - Health Metrics Browser
  • http://localhost:${app.server?.port}/workouts  - Workout Log
  • http://localhost:${app.server?.port}/nutrition - Nutrition Tracker
`);
