import { Elysia } from "elysia";
import { html } from "@elysiajs/html";
import { staticPlugin } from "@elysiajs/static";
import home from "./server/routes/home";
import metrics from "./server/routes/metrics";
import workouts from "./server/routes/workouts";
import nutrition from "./server/routes/nutrition";
import clinical from "./server/routes/clinical";
import ecg from "./server/routes/ecg";
import routes from "./server/routes/routes";

const app = new Elysia()
  .use(html())
  .use(staticPlugin())
  .use(home)
  .use(metrics)
  .use(workouts)
  .use(nutrition)
  .use(clinical)
  .use(ecg)
  .use(routes)
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
  • http://localhost:${app.server?.port}/clinical  - Clinical Records (FHIR)
  • http://localhost:${app.server?.port}/ecg       - ECG Recordings
  • http://localhost:${app.server?.port}/routes    - Workout Routes (GPS)
`);
