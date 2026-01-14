import { describe, expect, test, beforeAll, beforeEach } from "bun:test";
import { Elysia } from "elysia";
import { html } from "@elysiajs/html";
import { staticPlugin } from "@elysiajs/static";
import { Database } from "bun:sqlite";
import home from "../../src/server/routes/home";
import metrics from "../../src/server/routes/metrics";
import workouts from "../../src/server/routes/workouts";
import nutrition from "../../src/server/routes/nutrition";
import { initializeDatabase } from "../../src/db/schema";
import { setDatabase } from "../../src/db/client";

describe("Multi-user routing", () => {
  let app: Elysia;
  let db: Database;

  beforeEach(() => {
    // Initialize in-memory test database
    db = initializeDatabase(":memory:");
    setDatabase(db);

    // Insert test user
    db.run(
      "INSERT INTO users (username, display_name) VALUES (?, ?)",
      "jordan",
      "jordan"
    );

    // Insert some test data
    db.run(
      "INSERT INTO health_metrics (user_id, metric_type, value, unit, source_name, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?)",
      1,
      "weight",
      100,
      "kg",
      "Test Source",
      "2024-01-01",
      "2024-01-01"
    );

    db.run(
      "INSERT INTO workouts (user_id, activity_type, start_date, end_date) VALUES (?, ?, ?, ?)",
      1,
      "cycling",
      "2024-01-01",
      "2024-01-01"
    );

    db.run(
      "INSERT INTO nutrition (user_id, date, calories, protein_g, carbs_g, fat_g) VALUES (?, ?, ?, ?, ?, ?)",
      1,
      "2024-01-01",
      2000,
      150,
      200,
      70
    );

    // Create Elysia app
    app = new Elysia()
      .use(html())
      .use(staticPlugin())
      .use(home)
      .use(metrics)
      .use(workouts)
      .use(nutrition);
  });

  describe("User selection page", () => {
    test("GET / returns user selection page", async () => {
      const response = await app.handle(new Request("http://localhost/"));
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toContain("Select User");
      expect(text).toContain("Choose a user to view their health data");
    });

    test("User selection page shows available users", async () => {
      const response = await app.handle(new Request("http://localhost/"));
      const text = await response.text();
      expect(text).toContain("jordan");
    });
  });

  describe("User-specific routes", () => {
    test("GET /:username returns dashboard for valid user", async () => {
      const response = await app.handle(new Request("http://localhost/jordan"));
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toContain("Health Journey");
    });

    test("GET /:username/metrics returns metrics page", async () => {
      const response = await app.handle(
        new Request("http://localhost/jordan/metrics")
      );
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toContain("Health Metrics");
      expect(text).toContain("different health metrics");
    });

    test("GET /:username/workouts returns workouts page", async () => {
      const response = await app.handle(
        new Request("http://localhost/jordan/workouts")
      );
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toContain("Workouts");
      expect(text).toContain("Total Workouts");
    });

    test("GET /:username/nutrition returns nutrition page", async () => {
      const response = await app.handle(
        new Request("http://localhost/jordan/nutrition")
      );
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toContain("Nutrition");
      expect(text).toContain("Days Tracked");
    });

    test("GET /invalid-user redirects to home", async () => {
      const response = await app.handle(
        new Request("http://localhost/invalid-user")
      );
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toContain("User Not Found");
      expect(text).toContain("invalid-user");
    });
  });

  describe("Navigation links", () => {
    test("Dashboard includes user-specific navigation links", async () => {
      const response = await app.handle(new Request("http://localhost/jordan"));
      const text = await response.text();
      expect(text).toContain('href="/jordan"');
      expect(text).toContain('href="/jordan/metrics"');
      expect(text).toContain('href="/jordan/workouts"');
      expect(text).toContain('href="/jordan/nutrition"');
    });

    test("Navigation includes Switch User button", async () => {
      const response = await app.handle(new Request("http://localhost/jordan"));
      const text = await response.text();
      expect(text).toContain("Switch User");
      expect(text).toContain('href="/"');
    });

    test("User selection page has no user-specific nav", async () => {
      const response = await app.handle(new Request("http://localhost/"));
      const text = await response.text();
      expect(text).not.toContain("Switch User");
    });
  });

  describe("Weight display units", () => {
    test("Dashboard shows weight in lbs", async () => {
      const response = await app.handle(new Request("http://localhost/jordan"));
      const text = await response.text();
      // Weight should be shown in lbs, not kg
      expect(text).toContain("lbs");
      // Should not show raw kg values for weight card
      const weightSection = text.match(
        /<div class="stat-label">Weight<\/div>[\s\S]*?<\/div>/
      );
      if (weightSection) {
        expect(weightSection[0]).toContain("lbs");
      }
    });
  });
});
