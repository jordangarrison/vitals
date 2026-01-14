import sax from "sax";
import { createReadStream } from "fs";
import { getDatabase } from "../../db/client";
import type { HealthMetric, Workout, ActivitySummary } from "../../types/health";
import {
  parseAppleHealthDate,
  calculateDurationMinutes,
  parseDuration,
} from "../../utils/date-utils";
import {
  normalizeMetricType,
  normalizeWorkoutType,
  standardizeUnit,
  metersToKm,
  lbsToKg,
  kjToKcal,
  milesToKm,
} from "../../utils/unit-converter";
import { logger } from "../../utils/logger";

const BATCH_SIZE = 10000;

interface ParseStats {
  recordsProcessed: number;
  workoutsProcessed: number;
  activitiesProcessed: number;
  errors: string[];
}

export async function parseAppleHealthXML(
  userId: number,
  filePath: string
): Promise<ParseStats> {
  return new Promise((resolve, reject) => {
    logger.startPhase("Parsing Apple Health XML");

    const db = getDatabase();
    const stats: ParseStats = {
      recordsProcessed: 0,
      workoutsProcessed: 0,
      activitiesProcessed: 0,
      errors: [],
    };

    let recordBatch: HealthMetric[] = [];
    let workoutBatch: Workout[] = [];
    let currentWorkout: any = null;
    let currentWorkoutStats: any[] = [];

    const parser = sax.createStream(true, { trim: true });

    // Prepare insert statements
    const insertMetric = db.prepare(`
      INSERT INTO health_metrics (
        user_id, metric_type, value, unit, source_name, source_version,
        device, start_date, end_date, creation_date, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertWorkout = db.prepare(`
      INSERT INTO workouts (
        user_id, uuid, activity_type, start_date, end_date, duration_minutes,
        total_distance_km, total_energy_kcal, source_name, source_version,
        device, has_route, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertActivity = db.prepare(`
      INSERT INTO activity_summaries (
        user_id, date, active_energy_burned, active_energy_goal,
        move_time_minutes, move_time_goal, exercise_time_minutes,
        exercise_time_goal, stand_hours, stand_hours_goal
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const upsertProfile = db.prepare(`
      INSERT INTO user_profile (
        user_id, date_of_birth, biological_sex, blood_type,
        fitzpatrick_skin_type, cardio_fitness_medications_use
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        date_of_birth = excluded.date_of_birth,
        biological_sex = excluded.biological_sex,
        blood_type = excluded.blood_type,
        fitzpatrick_skin_type = excluded.fitzpatrick_skin_type,
        cardio_fitness_medications_use = excluded.cardio_fitness_medications_use
    `);

    function flushRecordBatch() {
      if (recordBatch.length === 0) return;

      try {
        db.run("BEGIN TRANSACTION");

        for (const record of recordBatch) {
          insertMetric.run(
            record.user_id,
            record.metric_type,
            record.value,
            record.unit,
            record.source_name,
            record.source_version || null,
            record.device || null,
            record.start_date,
            record.end_date,
            record.creation_date || null,
            record.metadata || null
          );
        }

        db.run("COMMIT");

        stats.recordsProcessed += recordBatch.length;
        logger.progress("Records", stats.recordsProcessed, stats.recordsProcessed);
      } catch (error) {
        db.run("ROLLBACK");
        stats.errors.push(`Batch insert failed: ${error}`);
      }

      recordBatch = [];
    }

    function flushWorkoutBatch() {
      if (workoutBatch.length === 0) return;

      try {
        db.run("BEGIN TRANSACTION");

        for (const workout of workoutBatch) {
          insertWorkout.run(
            workout.user_id,
            workout.uuid || null,
            workout.activity_type,
            workout.start_date,
            workout.end_date,
            workout.duration_minutes || null,
            workout.total_distance_km || null,
            workout.total_energy_kcal || null,
            workout.source_name || null,
            workout.source_version || null,
            workout.device || null,
            workout.has_route ? 1 : 0,
            workout.metadata || null
          );
        }

        db.run("COMMIT");

        stats.workoutsProcessed += workoutBatch.length;
      } catch (error) {
        db.run("ROLLBACK");
        stats.errors.push(`Workout batch insert failed: ${error}`);
      }

      workoutBatch = [];
    }

    parser.on("opentag", (node: any) => {
      try {
        if (node.name === "Record") {
          // Parse health metric record
          const attrs = node.attributes;

          if (!attrs.type || !attrs.value) return;

          const metricType = normalizeMetricType(attrs.type);
          let value = parseFloat(attrs.value);
          const originalUnit = attrs.unit || "count";
          let unit = originalUnit;

          // Unit conversions to standardize data (check original unit before standardizing)
          if (originalUnit === "mi") {
            value = milesToKm(value);
            unit = "km";
          } else if (originalUnit === "lb") {
            value = lbsToKg(value);
            unit = "kg";
          } else if (originalUnit === "kJ") {
            value = kjToKcal(value);
            unit = "kcal";
          } else if (originalUnit === "m") {
            value = metersToKm(value);
            unit = "km";
          } else {
            // Only standardize if we didn't convert
            unit = standardizeUnit(originalUnit);
          }

          if (isNaN(value)) return;

          recordBatch.push({
            user_id: userId,
            metric_type: metricType,
            value,
            unit,
            source_name: attrs.sourceName || "Unknown",
            source_version: attrs.sourceVersion,
            device: attrs.device,
            start_date: parseAppleHealthDate(attrs.startDate),
            end_date: parseAppleHealthDate(attrs.endDate),
            creation_date: attrs.creationDate
              ? parseAppleHealthDate(attrs.creationDate)
              : undefined,
          });

          if (recordBatch.length >= BATCH_SIZE) {
            flushRecordBatch();
          }
        } else if (node.name === "Workout") {
          // Start parsing a workout
          const attrs = node.attributes;

          currentWorkout = {
            user_id: userId,
            uuid: attrs.uuid,
            activity_type: normalizeWorkoutType(attrs.workoutActivityType),
            start_date: parseAppleHealthDate(attrs.startDate),
            end_date: parseAppleHealthDate(attrs.endDate),
            duration_minutes: parseDuration(attrs.duration, attrs.durationUnit),
            total_distance_km:
              attrs.totalDistance && attrs.totalDistanceUnit === "mi"
                ? milesToKm(parseFloat(attrs.totalDistance))
                : attrs.totalDistance
                ? parseFloat(attrs.totalDistance)
                : undefined,
            total_energy_kcal:
              attrs.totalEnergyBurned && attrs.totalEnergyBurnedUnit === "Cal"
                ? parseFloat(attrs.totalEnergyBurned)
                : undefined,
            source_name: attrs.sourceName,
            source_version: attrs.sourceVersion,
            device: attrs.device,
            has_route: false,
          };

          currentWorkoutStats = [];
        } else if (node.name === "WorkoutStatistics" && currentWorkout) {
          // Collect workout statistics as metadata
          const attrs = node.attributes;
          currentWorkoutStats.push({
            type: normalizeMetricType(attrs.type),
            average: attrs.average,
            maximum: attrs.maximum,
            minimum: attrs.minimum,
            sum: attrs.sum,
            unit: attrs.unit,
          });
        } else if (node.name === "ActivitySummary") {
          // Parse activity summary (Apple Watch rings)
          const attrs = node.attributes;

          try {
            insertActivity.run(
              userId,
              attrs.dateComponents,
              parseFloat(attrs.activeEnergyBurned) || null,
              parseFloat(attrs.activeEnergyBurnedGoal) || null,
              parseFloat(attrs.appleMoveTime) || null,
              parseFloat(attrs.appleMoveTimeGoal) || null,
              parseFloat(attrs.appleExerciseTime) || null,
              parseFloat(attrs.appleExerciseTimeGoal) || null,
              parseInt(attrs.appleStandHours) || null,
              parseInt(attrs.appleStandHoursGoal) || null
            );

            stats.activitiesProcessed++;
          } catch (error) {
            stats.errors.push(`Activity insert failed: ${error}`);
          }
        } else if (node.name === "Me") {
          // Parse user profile
          const attrs = node.attributes;

          try {
            upsertProfile.run(
              userId,
              attrs.HKCharacteristicTypeIdentifierDateOfBirth || "1900-01-01",
              attrs.HKCharacteristicTypeIdentifierBiologicalSex?.replace(
                "HKBiologicalSex",
                ""
              ) || null,
              attrs.HKCharacteristicTypeIdentifierBloodType?.replace(
                "HKBloodType",
                ""
              ) || null,
              attrs.HKCharacteristicTypeIdentifierFitzpatrickSkinType?.replace(
                "HKFitzpatrickSkinType",
                ""
              ) || null,
              attrs.HKCharacteristicTypeIdentifierCardioFitnessMedicationsUse || null
            );

            logger.info("User profile imported");
          } catch (error) {
            stats.errors.push(`Profile insert failed: ${error}`);
          }
        }
      } catch (error) {
        stats.errors.push(`Parse error: ${error}`);
      }
    });

    parser.on("closetag", (name: string) => {
      if (name === "Workout" && currentWorkout) {
        // Extract data from WorkoutStatistics if not already set
        if (currentWorkoutStats.length > 0) {
          let activeEnergy = 0;
          let basalEnergy = 0;
          let distanceMiles = 0;
          let distanceKm = 0;

          for (const stat of currentWorkoutStats) {
            if (
              stat.type === "active_energy_burned" &&
              stat.sum &&
              stat.unit === "Cal"
            ) {
              activeEnergy = parseFloat(stat.sum);
            } else if (
              stat.type === "basal_energy_burned" &&
              stat.sum &&
              stat.unit === "Cal"
            ) {
              basalEnergy = parseFloat(stat.sum);
            } else if (
              (stat.type === "cycling_distance" ||
                stat.type === "walking_running_distance" ||
                stat.type === "swimming_distance") &&
              stat.sum
            ) {
              if (stat.unit === "mi") {
                distanceMiles = parseFloat(stat.sum);
              } else if (stat.unit === "km") {
                distanceKm = parseFloat(stat.sum);
              }
            }
          }

          // Set total energy if not already set and we found energy data
          if (!currentWorkout.total_energy_kcal && (activeEnergy > 0 || basalEnergy > 0)) {
            currentWorkout.total_energy_kcal = activeEnergy + basalEnergy;
          }

          // Set distance if not already set and we found distance data
          if (!currentWorkout.total_distance_km) {
            if (distanceMiles > 0) {
              currentWorkout.total_distance_km = milesToKm(distanceMiles);
            } else if (distanceKm > 0) {
              currentWorkout.total_distance_km = distanceKm;
            }
          }
        }

        // Finalize workout with statistics
        if (currentWorkoutStats.length > 0) {
          currentWorkout.metadata = JSON.stringify({
            statistics: currentWorkoutStats,
          });
        }

        workoutBatch.push(currentWorkout);

        if (workoutBatch.length >= 100) {
          flushWorkoutBatch();
        }

        currentWorkout = null;
        currentWorkoutStats = [];
      }
    });

    parser.on("end", () => {
      // Flush remaining batches
      flushRecordBatch();
      flushWorkoutBatch();

      logger.endPhase(stats.recordsProcessed + stats.workoutsProcessed);
      logger.info(
        `  Records: ${stats.recordsProcessed.toLocaleString()}, Workouts: ${stats.workoutsProcessed.toLocaleString()}, Activities: ${stats.activitiesProcessed.toLocaleString()}`
      );

      if (stats.errors.length > 0) {
        logger.warn(`Encountered ${stats.errors.length} errors during parsing`);
      }

      resolve(stats);
    });

    parser.on("error", (error: Error) => {
      logger.error(`XML parsing error: ${error.message}`);
      reject(error);
    });

    // Start streaming the file
    createReadStream(filePath).pipe(parser);
  });
}
