import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { unlinkSync, existsSync } from "fs";
import { resolve } from "path";
import { initializeDatabase } from "../../src/db/schema";
import { setDatabase } from "../../src/db/client";
import {
  getOrCreateUser,
  getAllUsers,
  getUserById,
  getUserProfile,
  upsertUserProfile,
  getMetricTypes,
  getMetricDateRange,
  recordImport,
  getImportHistory,
} from "../../src/db/queries";

const TEST_DB_PATH = resolve(import.meta.dir, "../../data/test-queries.db");

describe("database queries", () => {
  let db: Database;

  beforeEach(() => {
    // Clean up any existing test database
    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH);
    }

    // Initialize fresh test database
    db = initializeDatabase(TEST_DB_PATH);

    // Set the test database as the singleton
    setDatabase(db);
  });

  afterEach(() => {
    db.close();
    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH);
    }
  });

  describe("user management", () => {
    test("creates new user", () => {
      const user = getOrCreateUser("testuser", "Test User");

      expect(user.id).toBeGreaterThan(0);
      expect(user.username).toBe("testuser");
      expect(user.display_name).toBe("Test User");
      expect(user.created_at).toBeDefined();
    });

    test("returns existing user", () => {
      const user1 = getOrCreateUser("testuser", "Test User");
      const user2 = getOrCreateUser("testuser", "Different Name");

      expect(user1.id).toBe(user2.id);
      expect(user2.display_name).toBe("Test User"); // Original name preserved
    });

    test("gets all users", () => {
      getOrCreateUser("user1", "User One");
      getOrCreateUser("user2", "User Two");
      getOrCreateUser("user3", "User Three");

      const users = getAllUsers();
      expect(users.length).toBe(3);
      expect(users[0].username).toBe("user1");
    });

    test("gets user by ID", () => {
      const created = getOrCreateUser("testuser", "Test User");
      const found = getUserById(created.id);

      expect(found).toBeDefined();
      expect(found?.username).toBe("testuser");
    });

    test("returns null for non-existent user ID", () => {
      const found = getUserById(999);
      expect(found).toBeNull();
    });
  });

  describe("user profile", () => {
    test("creates user profile", () => {
      const user = getOrCreateUser("testuser");

      upsertUserProfile({
        user_id: user.id,
        date_of_birth: "1990-01-01",
        biological_sex: "Male",
        blood_type: "O+",
      });

      const profile = getUserProfile(user.id);
      expect(profile).toBeDefined();
      expect(profile?.date_of_birth).toBe("1990-01-01");
      expect(profile?.biological_sex).toBe("Male");
      expect(profile?.blood_type).toBe("O+");
    });

    test("updates existing profile", () => {
      const user = getOrCreateUser("testuser");

      upsertUserProfile({
        user_id: user.id,
        date_of_birth: "1990-01-01",
        biological_sex: "Male",
      });

      upsertUserProfile({
        user_id: user.id,
        date_of_birth: "1990-01-01",
        biological_sex: "Male",
        blood_type: "O+",
      });

      const profile = getUserProfile(user.id);
      expect(profile?.blood_type).toBe("O+");
    });

    test("returns null for non-existent profile", () => {
      const profile = getUserProfile(999);
      expect(profile).toBeNull();
    });
  });

  describe("metric queries", () => {
    test("gets distinct metric types", () => {
      const user = getOrCreateUser("testuser");

      // Insert some test metrics
      db.prepare(
        `INSERT INTO health_metrics (user_id, metric_type, value, unit, source_name, start_date, end_date)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(user.id, "steps", 10000, "count", "Test", "2024-01-01", "2024-01-01");

      db.prepare(
        `INSERT INTO health_metrics (user_id, metric_type, value, unit, source_name, start_date, end_date)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(user.id, "heart_rate", 70, "bpm", "Test", "2024-01-01", "2024-01-01");

      db.prepare(
        `INSERT INTO health_metrics (user_id, metric_type, value, unit, source_name, start_date, end_date)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(user.id, "steps", 12000, "count", "Test", "2024-01-02", "2024-01-02");

      const types = getMetricTypes(user.id);
      expect(types.length).toBe(2);
      expect(types).toContain("steps");
      expect(types).toContain("heart_rate");
    });

    test("gets metric date range", () => {
      const user = getOrCreateUser("testuser");

      db.prepare(
        `INSERT INTO health_metrics (user_id, metric_type, value, unit, source_name, start_date, end_date)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(user.id, "steps", 10000, "count", "Test", "2024-01-01", "2024-01-01");

      db.prepare(
        `INSERT INTO health_metrics (user_id, metric_type, value, unit, source_name, start_date, end_date)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(user.id, "steps", 12000, "count", "Test", "2024-01-15", "2024-01-15");

      const range = getMetricDateRange(user.id, "steps");
      expect(range).toBeDefined();
      expect(range?.min_date).toBe("2024-01-01");
      expect(range?.max_date).toBe("2024-01-15");
      expect(range?.count).toBe(2);
    });
  });

  describe("import history", () => {
    test("records import", () => {
      const user = getOrCreateUser("testuser");

      recordImport(user.id, "apple-health", "export.xml", 1000, "success");

      const history = getImportHistory(user.id, 10);
      expect(history.length).toBe(1);
      expect(history[0].source_type).toBe("apple-health");
      expect(history[0].records_imported).toBe(1000);
      expect(history[0].status).toBe("success");
    });

    test("records multiple imports", () => {
      const user = getOrCreateUser("testuser");

      recordImport(user.id, "apple-health", "export.xml", 1000, "success");
      recordImport(user.id, "macrofactor", "data.xlsx", 200, "success");

      const history = getImportHistory(user.id, 10);
      expect(history.length).toBe(2);
    });

    test("limits history results", () => {
      const user = getOrCreateUser("testuser");

      for (let i = 0; i < 20; i++) {
        recordImport(user.id, "test", `file${i}.xml`, 100, "success");
      }

      const history = getImportHistory(user.id, 5);
      expect(history.length).toBe(5);
    });

    test("records errors in import", () => {
      const user = getOrCreateUser("testuser");

      recordImport(user.id, "test", "file.xml", 0, "failed", "Test error message");

      const history = getImportHistory(user.id, 10);
      expect(history[0].status).toBe("failed");
      expect(history[0].error_log).toBe("Test error message");
    });
  });
});
