import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { unlinkSync, existsSync, writeFileSync } from "fs";
import { resolve } from "path";
import { initializeDatabase } from "../../src/db/schema";
import { setDatabase, getDatabase } from "../../src/db/client";
import { getOrCreateUser } from "../../src/db/queries";
import { parseAppleHealthXML } from "../../src/importers/apple-health/xml-parser";

const TEST_DB_PATH = resolve(import.meta.dir, "../../data/test-apple-health.db");
const TEST_XML_PATH = resolve(import.meta.dir, "../fixtures/sample-export.xml");

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<HealthData locale="en_US">
  <ExportDate value="2024-01-15 10:00:00 -0600"/>
  <Me HKCharacteristicTypeIdentifierDateOfBirth="1990-01-01"
      HKCharacteristicTypeIdentifierBiologicalSex="HKBiologicalSexMale"
      HKCharacteristicTypeIdentifierBloodType="HKBloodTypeOPositive"/>
  <Record type="HKQuantityTypeIdentifierStepCount" sourceName="iPhone" unit="count"
          creationDate="2024-01-01 08:00:00 -0600"
          startDate="2024-01-01 08:00:00 -0600"
          endDate="2024-01-01 09:00:00 -0600" value="1000"/>
  <Record type="HKQuantityTypeIdentifierStepCount" sourceName="iPhone" unit="count"
          creationDate="2024-01-01 09:00:00 -0600"
          startDate="2024-01-01 09:00:00 -0600"
          endDate="2024-01-01 10:00:00 -0600" value="1500"/>
  <Record type="HKQuantityTypeIdentifierHeartRate" sourceName="Apple Watch" unit="count/min"
          creationDate="2024-01-01 08:00:00 -0600"
          startDate="2024-01-01 08:00:00 -0600"
          endDate="2024-01-01 08:00:00 -0600" value="72"/>
  <Record type="HKQuantityTypeIdentifierBodyMass" sourceName="Health" unit="lb"
          creationDate="2024-01-01 07:00:00 -0600"
          startDate="2024-01-01 07:00:00 -0600"
          endDate="2024-01-01 07:00:00 -0600" value="150"/>
  <Workout workoutActivityType="HKWorkoutActivityTypeRunning"
           duration="30" durationUnit="min"
           totalDistance="3" totalDistanceUnit="mi"
           totalEnergyBurned="250" totalEnergyBurnedUnit="Cal"
           sourceName="Apple Watch"
           creationDate="2024-01-01 08:00:00 -0600"
           startDate="2024-01-01 08:00:00 -0600"
           endDate="2024-01-01 08:30:00 -0600">
    <WorkoutStatistics type="HKQuantityTypeIdentifierHeartRate"
                      average="150" maximum="175" minimum="120" unit="count/min"/>
  </Workout>
  <ActivitySummary dateComponents="2024-01-01"
                   activeEnergyBurned="500" activeEnergyBurnedGoal="600"
                   appleExerciseTime="30" appleExerciseTimeGoal="30"
                   appleStandHours="10" appleStandHoursGoal="12"/>
</HealthData>`;

describe("Apple Health importer", () => {
  let db: Database;
  let userId: number;

  beforeEach(() => {
    // Clean up test files
    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH);
    }

    // Create test XML file
    writeFileSync(TEST_XML_PATH, SAMPLE_XML);

    // Initialize test database
    db = initializeDatabase(TEST_DB_PATH);
    setDatabase(db);

    // Create test user
    const user = getOrCreateUser("testuser", "Test User");
    userId = user.id;
  });

  afterEach(() => {
    db.close();

    // Clean up
    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH);
    }
    if (existsSync(TEST_XML_PATH)) {
      unlinkSync(TEST_XML_PATH);
    }
  });

  test("parses XML and imports records", async () => {
    const stats = await parseAppleHealthXML(userId, TEST_XML_PATH);

    expect(stats.recordsProcessed).toBe(4); // 2 steps + 1 heart rate + 1 weight
    expect(stats.workoutsProcessed).toBe(1);
    expect(stats.activitiesProcessed).toBe(1);
    expect(stats.errors.length).toBe(0);
  });

  test("imports health metrics correctly", async () => {
    await parseAppleHealthXML(userId, TEST_XML_PATH);

    const db = getDatabase();

    // Check steps records
    const stepsCount = db.query(`
      SELECT COUNT(*) as count FROM health_metrics
      WHERE user_id = ? AND metric_type = 'steps'
    `).get(userId) as { count: number };

    expect(stepsCount.count).toBe(2);

    // Check heart rate record
    const heartRate = db.query(`
      SELECT value FROM health_metrics
      WHERE user_id = ? AND metric_type = 'heart_rate'
    `).get(userId) as { value: number };

    expect(heartRate.value).toBe(72);

    // Check weight conversion (lb to kg)
    const weight = db.query(`
      SELECT value, unit FROM health_metrics
      WHERE user_id = ? AND metric_type = 'weight'
    `).get(userId) as { value: number; unit: string };

    expect(weight.unit).toBe("kg");
    expect(weight.value).toBeCloseTo(68.04, 1); // 150 lbs ≈ 68.04 kg
  });

  test("imports workouts correctly", async () => {
    await parseAppleHealthXML(userId, TEST_XML_PATH);

    const db = getDatabase();

    const workout = db.query(`
      SELECT activity_type, duration_minutes, total_distance_km, total_energy_kcal
      FROM workouts
      WHERE user_id = ?
    `).get(userId) as {
      activity_type: string;
      duration_minutes: number;
      total_distance_km: number;
      total_energy_kcal: number;
    };

    expect(workout.activity_type).toBe("running");
    expect(workout.duration_minutes).toBe(30);
    expect(workout.total_distance_km).toBeCloseTo(4.83, 1); // 3 mi ≈ 4.83 km
    expect(workout.total_energy_kcal).toBe(250);
  });

  test("imports activity summaries correctly", async () => {
    await parseAppleHealthXML(userId, TEST_XML_PATH);

    const db = getDatabase();

    const activity = db.query(`
      SELECT date, active_energy_burned, active_energy_goal,
             exercise_time_minutes, stand_hours
      FROM activity_summaries
      WHERE user_id = ?
    `).get(userId) as {
      date: string;
      active_energy_burned: number;
      active_energy_goal: number;
      exercise_time_minutes: number;
      stand_hours: number;
    };

    expect(activity.date).toBe("2024-01-01");
    expect(activity.active_energy_burned).toBe(500);
    expect(activity.active_energy_goal).toBe(600);
    expect(activity.exercise_time_minutes).toBe(30);
    expect(activity.stand_hours).toBe(10);
  });

  test("imports user profile correctly", async () => {
    await parseAppleHealthXML(userId, TEST_XML_PATH);

    const db = getDatabase();

    const profile = db.query(`
      SELECT date_of_birth, biological_sex, blood_type
      FROM user_profile
      WHERE user_id = ?
    `).get(userId) as {
      date_of_birth: string;
      biological_sex: string;
      blood_type: string;
    };

    expect(profile.date_of_birth).toBe("1990-01-01");
    expect(profile.biological_sex).toBe("Male");
    expect(profile.blood_type).toBe("OPositive");
  });
});
