/**
 * Type definitions for health data structures
 */

export interface HealthMetric {
  user_id: number;
  metric_type: string;
  value: number;
  unit: string;
  source_name: string;
  source_version?: string;
  device?: string;
  start_date: string;
  end_date: string;
  creation_date?: string;
  metadata?: string;
}

export interface Workout {
  user_id: number;
  uuid?: string;
  activity_type: string;
  start_date: string;
  end_date: string;
  duration_minutes?: number;
  total_distance_km?: number;
  total_energy_kcal?: number;
  source_name?: string;
  source_version?: string;
  device?: string;
  has_route: boolean;
  metadata?: string;
}

export interface ActivitySummary {
  user_id: number;
  date: string;
  active_energy_burned?: number;
  active_energy_goal?: number;
  move_time_minutes?: number;
  move_time_goal?: number;
  exercise_time_minutes?: number;
  exercise_time_goal?: number;
  stand_hours?: number;
  stand_hours_goal?: number;
}

export interface SleepSession {
  user_id: number;
  start_date: string;
  end_date: string;
  duration_hours?: number;
  sleep_type?: string;
  source_name?: string;
  metadata?: string;
}

export interface Nutrition {
  user_id: number;
  date: string;
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  fiber_g?: number;
  // Micronutrients
  calcium_mg?: number;
  chloride_mg?: number;
  cholesterol_mg?: number;
  chromium_mcg?: number;
  copper_mg?: number;
  folate_mcg?: number;
  iodine_mcg?: number;
  iron_mg?: number;
  magnesium_mg?: number;
  manganese_mg?: number;
  molybdenum_mcg?: number;
  niacin_mg?: number;
  omega_3_g?: number;
  omega_6_g?: number;
  pantothenic_acid_mg?: number;
  phosphorus_mg?: number;
  potassium_mg?: number;
  riboflavin_mg?: number;
  selenium_mcg?: number;
  sodium_mg?: number;
  thiamin_mg?: number;
  vitamin_a_mcg?: number;
  vitamin_b6_mg?: number;
  vitamin_b12_mcg?: number;
  vitamin_c_mg?: number;
  vitamin_d_mcg?: number;
  vitamin_e_mg?: number;
  vitamin_k_mcg?: number;
  zinc_mg?: number;
  // Additional macros
  saturated_fat_g?: number;
  monounsaturated_fat_g?: number;
  polyunsaturated_fat_g?: number;
  trans_fat_g?: number;
  sugar_g?: number;
  added_sugar_g?: number;
  sugar_alcohol_g?: number;
  starch_g?: number;
  alcohol_g?: number;
  caffeine_mg?: number;
  water_ml?: number;
  // Additional vitamins/minerals
  choline_mg?: number;
  biotin_mcg?: number;
  boron_mg?: number;
  cobalt_mcg?: number;
  fluoride_mg?: number;
  nickel_mg?: number;
  silicon_mg?: number;
  vanadium_mcg?: number;
  source_name?: string;
  metadata?: string;
}

export interface BodyMetrics {
  user_id: number;
  date: string;
  weight_kg?: number;
  weight_lb?: number;
  body_fat_percent?: number;
  bmi?: number;
  lean_body_mass_kg?: number;
  // Body measurements
  chest_cm?: number;
  waist_cm?: number;
  hips_cm?: number;
  neck_cm?: number;
  shoulders_cm?: number;
  left_bicep_cm?: number;
  right_bicep_cm?: number;
  left_forearm_cm?: number;
  right_forearm_cm?: number;
  left_thigh_cm?: number;
  right_thigh_cm?: number;
  left_calf_cm?: number;
  right_calf_cm?: number;
  left_wrist_cm?: number;
  right_wrist_cm?: number;
  left_ankle_cm?: number;
  right_ankle_cm?: number;
  upper_abdomen_cm?: number;
  lower_abdomen_cm?: number;
  glutes_cm?: number;
  source_name: string;
}

export interface ImportResult {
  success: boolean;
  recordsImported: number;
  errors: string[];
  warnings: string[];
  timeTaken: number;
}

export interface ImportProgress {
  phase: string;
  current: number;
  total: number;
  message: string;
}

/**
 * Apple Health specific types
 */
export interface AppleHealthRecord {
  type: string;
  value: string;
  unit?: string;
  sourceName: string;
  sourceVersion?: string;
  device?: string;
  creationDate?: string;
  startDate: string;
  endDate: string;
}

export interface AppleHealthWorkout {
  workoutActivityType: string;
  duration?: string;
  durationUnit?: string;
  totalDistance?: string;
  totalDistanceUnit?: string;
  totalEnergyBurned?: string;
  totalEnergyBurnedUnit?: string;
  sourceName?: string;
  sourceVersion?: string;
  device?: string;
  creationDate?: string;
  startDate: string;
  endDate: string;
}

export interface AppleHealthMe {
  HKCharacteristicTypeIdentifierDateOfBirth?: string;
  HKCharacteristicTypeIdentifierBiologicalSex?: string;
  HKCharacteristicTypeIdentifierBloodType?: string;
  HKCharacteristicTypeIdentifierFitzpatrickSkinType?: string;
  HKCharacteristicTypeIdentifierCardioFitnessMedicationsUse?: string;
}

/**
 * MacroFactor specific types
 */
export interface MacroFactorCaloriesRow {
  date: string;
  calories?: number;
  fat_g?: number;
  carbs_g?: number;
  protein_g?: number;
}

export interface MacroFactorWeightRow {
  date: string;
  weight_lb?: number;
  body_fat_percent?: number;
}

export interface MacroFactorBodyMetricsRow {
  date: string;
  [key: string]: any; // Dynamic body measurement columns
}

/**
 * Clinical Records (FHIR)
 */
export interface ClinicalRecord {
  id?: number;
  user_id: number;
  resource_type: string;
  resource_id: string;
  recorded_date?: string;
  display_name?: string;
  code?: string;
  code_system?: string;
  value_text?: string;
  value_quantity?: number;
  value_unit?: string;
  file_path: string;
  raw_json?: string;
  metadata?: string;
}

/**
 * ECG Recordings
 */
export interface ECGRecording {
  id?: number;
  user_id: number;
  recorded_date: string;
  classification?: string;
  symptoms?: string;
  average_heart_rate?: number;
  software_version?: string;
  device?: string;
  sample_rate_hz: number;
  file_path: string;
  waveform_json?: string;
}

/**
 * Workout Route
 */
export interface WorkoutRoute {
  id?: number;
  workout_id: number;
  file_path: string;
  start_date?: string;
  end_date?: string;
}
