import { describe, expect, test, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { initializeDatabase } from "../../src/db/schema";
import { setDatabase } from "../../src/db/client";
import { parseAppleHealthXML } from "../../src/importers/apple-health/xml-parser";

describe("Workout Energy Parsing", () => {
  let db: Database;
  const userId = 1;

  beforeEach(() => {
    db = initializeDatabase(":memory:");
    setDatabase(db);

    // Insert test user
    db.run(
      "INSERT INTO users (username, display_name) VALUES (?, ?)",
      "test",
      "Test User"
    );
  });

  test("parses workout with WorkoutStatistics energy", async () => {
    const testXML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE HealthData [
<!ELEMENT HealthData (Record*, Workout*, ActivitySummary*)>
<!ELEMENT Record EMPTY>
<!ELEMENT Workout (MetadataEntry*, WorkoutStatistics*, WorkoutRoute?)>
<!ELEMENT WorkoutStatistics EMPTY>
]>
<HealthData>
  <Workout workoutActivityType="HKWorkoutActivityTypeCycling"
           duration="9.30" durationUnit="min"
           sourceName="Test Watch"
           startDate="2026-01-13 14:58:41 -0600"
           endDate="2026-01-13 15:07:59 -0600">
    <WorkoutStatistics type="HKQuantityTypeIdentifierActiveEnergyBurned"
                      startDate="2026-01-13 14:58:41 -0600"
                      endDate="2026-01-13 15:07:59 -0600"
                      sum="17.7314"
                      unit="Cal"/>
    <WorkoutStatistics type="HKQuantityTypeIdentifierBasalEnergyBurned"
                      startDate="2026-01-13 14:58:41 -0600"
                      endDate="2026-01-13 15:07:59 -0600"
                      sum="5.73425"
                      unit="Cal"/>
  </Workout>
</HealthData>`;

    // Write test XML to temp file
    const tmpFile = "/tmp/test-workout-energy.xml";
    await Bun.write(tmpFile, testXML);

    // Parse the XML (userId first, then filePath)
    await parseAppleHealthXML(userId, tmpFile);

    // Check that workout was imported with correct total energy
    const workout = db
      .query<{ total_energy_kcal: number; activity_type: string }>(
        "SELECT total_energy_kcal, activity_type FROM workouts WHERE user_id = ?"
      )
      .get(userId);

    expect(workout).toBeDefined();
    expect(workout?.activity_type).toBe("cycling");
    expect(workout?.total_energy_kcal).toBeCloseTo(23.46565, 4); // 17.7314 + 5.73425
  });

  test("parses workout with only ActiveEnergyBurned", async () => {
    const testXML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE HealthData [
<!ELEMENT HealthData (Workout*)>
<!ELEMENT Workout (WorkoutStatistics*)>
<!ELEMENT WorkoutStatistics EMPTY>
]>
<HealthData>
  <Workout workoutActivityType="HKWorkoutActivityTypeRunning"
           duration="30" durationUnit="min"
           sourceName="Test Watch"
           startDate="2026-01-10 10:00:00 -0600"
           endDate="2026-01-10 10:30:00 -0600">
    <WorkoutStatistics type="HKQuantityTypeIdentifierActiveEnergyBurned"
                      sum="250"
                      unit="Cal"/>
  </Workout>
</HealthData>`;

    const tmpFile = "/tmp/test-workout-active-only.xml";
    await Bun.write(tmpFile, testXML);

    await parseAppleHealthXML(userId, tmpFile);

    const workout = db
      .query<{ total_energy_kcal: number }>(
        "SELECT total_energy_kcal FROM workouts WHERE user_id = ?"
      )
      .get(userId);

    expect(workout?.total_energy_kcal).toBe(250);
  });

  test("handles workout with no energy statistics", async () => {
    const testXML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE HealthData [
<!ELEMENT HealthData (Workout*)>
<!ELEMENT Workout (WorkoutStatistics*)>
<!ELEMENT WorkoutStatistics EMPTY>
]>
<HealthData>
  <Workout workoutActivityType="HKWorkoutActivityTypeYoga"
           duration="45" durationUnit="min"
           sourceName="Test Watch"
           startDate="2026-01-09 08:00:00 -0600"
           endDate="2026-01-09 08:45:00 -0600">
    <WorkoutStatistics type="HKQuantityTypeIdentifierHeartRate"
                      average="95"
                      unit="count/min"/>
  </Workout>
</HealthData>`;

    const tmpFile = "/tmp/test-workout-no-energy.xml";
    await Bun.write(tmpFile, testXML);

    await parseAppleHealthXML(userId, tmpFile);

    const workout = db
      .query<{ total_energy_kcal: number | null }>(
        "SELECT total_energy_kcal FROM workouts WHERE user_id = ?"
      )
      .get(userId);

    expect(workout?.total_energy_kcal).toBeNull();
  });

  test("parses workout with distance from WorkoutStatistics", async () => {
    const testXML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE HealthData [
<!ELEMENT HealthData (Workout*)>
<!ELEMENT Workout (WorkoutStatistics*)>
<!ELEMENT WorkoutStatistics EMPTY>
]>
<HealthData>
  <Workout workoutActivityType="HKWorkoutActivityTypeCycling"
           duration="9.30" durationUnit="min"
           sourceName="Test Watch"
           startDate="2026-01-13 14:58:41 -0600"
           endDate="2026-01-13 15:07:59 -0600">
    <WorkoutStatistics type="HKQuantityTypeIdentifierActiveEnergyBurned"
                      sum="17.7314"
                      unit="Cal"/>
    <WorkoutStatistics type="HKQuantityTypeIdentifierDistanceCycling"
                      sum="0.433978"
                      unit="mi"/>
  </Workout>
</HealthData>`;

    const tmpFile = "/tmp/test-workout-distance.xml";
    await Bun.write(tmpFile, testXML);

    await parseAppleHealthXML(userId, tmpFile);

    const workout = db
      .query<{ total_distance_km: number; total_energy_kcal: number }>(
        "SELECT total_distance_km, total_energy_kcal FROM workouts WHERE user_id = ?"
      )
      .get(userId);

    expect(workout?.total_energy_kcal).toBeCloseTo(17.7314, 4);
    expect(workout?.total_distance_km).toBeCloseTo(0.698, 2); // 0.433978 mi → km
  });
});
