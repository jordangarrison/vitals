/**
 * Unit conversion utilities for health metrics
 */

/**
 * Convert pounds to kilograms
 */
export function lbsToKg(lbs: number): number {
  return lbs * 0.453592;
}

/**
 * Convert kilograms to pounds
 */
export function kgToLbs(kg: number): number {
  return kg / 0.453592;
}

/**
 * Convert miles to kilometers
 */
export function milesToKm(miles: number): number {
  return miles * 1.60934;
}

/**
 * Convert kilometers to miles
 */
export function kmToMiles(km: number): number {
  return km / 1.60934;
}

/**
 * Convert kilocalories to kilojoules
 */
export function kcalToKj(kcal: number): number {
  return kcal * 4.184;
}

/**
 * Convert kilojoules to kilocalories
 */
export function kjToKcal(kj: number): number {
  return kj / 4.184;
}

/**
 * Convert inches to centimeters
 */
export function inchesToCm(inches: number): number {
  return inches * 2.54;
}

/**
 * Convert centimeters to inches
 */
export function cmToInches(cm: number): number {
  return cm / 2.54;
}

/**
 * Convert meters to kilometers
 */
export function metersToKm(meters: number): number {
  return meters / 1000;
}

/**
 * Convert milliliters to ounces
 */
export function mlToOz(ml: number): number {
  return ml / 29.5735;
}

/**
 * Convert ounces to milliliters
 */
export function ozToMl(oz: number): number {
  return oz * 29.5735;
}

/**
 * Normalize Apple Health quantity type to simplified metric name
 * Example: "HKQuantityTypeIdentifierStepCount" -> "steps"
 */
export function normalizeMetricType(appleHealthType: string): string {
  const mapping: Record<string, string> = {
    // Activity
    HKQuantityTypeIdentifierStepCount: "steps",
    HKQuantityTypeIdentifierDistanceWalkingRunning: "walking_running_distance",
    HKQuantityTypeIdentifierDistanceCycling: "cycling_distance",
    HKQuantityTypeIdentifierDistanceSwimming: "swimming_distance",
    HKQuantityTypeIdentifierFlightsClimbed: "flights_climbed",
    HKQuantityTypeIdentifierAppleExerciseTime: "exercise_time",
    HKQuantityTypeIdentifierAppleStandTime: "stand_time",
    HKQuantityTypeIdentifierPushCount: "push_count",
    HKQuantityTypeIdentifierDistanceWheelchair: "wheelchair_distance",
    HKQuantityTypeIdentifierSwimmingStrokeCount: "swimming_stroke_count",

    // Heart
    HKQuantityTypeIdentifierHeartRate: "heart_rate",
    HKQuantityTypeIdentifierRestingHeartRate: "resting_heart_rate",
    HKQuantityTypeIdentifierWalkingHeartRateAverage: "walking_heart_rate_avg",
    HKQuantityTypeIdentifierHeartRateVariabilitySDNN: "heart_rate_variability",
    HKQuantityTypeIdentifierVO2Max: "vo2_max",
    HKQuantityTypeIdentifierHeartRateRecoveryOneMinute: "heart_rate_recovery",

    // Body Measurements
    HKQuantityTypeIdentifierBodyMass: "weight",
    HKQuantityTypeIdentifierBodyMassIndex: "bmi",
    HKQuantityTypeIdentifierBodyFatPercentage: "body_fat_percent",
    HKQuantityTypeIdentifierLeanBodyMass: "lean_body_mass",
    HKQuantityTypeIdentifierHeight: "height",
    HKQuantityTypeIdentifierWaistCircumference: "waist_circumference",

    // Nutrition
    HKQuantityTypeIdentifierDietaryEnergyConsumed: "calories",
    HKQuantityTypeIdentifierDietaryProtein: "protein",
    HKQuantityTypeIdentifierDietaryCarbohydrates: "carbs",
    HKQuantityTypeIdentifierDietaryFatTotal: "fat",
    HKQuantityTypeIdentifierDietaryFatSaturated: "saturated_fat",
    HKQuantityTypeIdentifierDietaryFatMonounsaturated: "monounsaturated_fat",
    HKQuantityTypeIdentifierDietaryFatPolyunsaturated: "polyunsaturated_fat",
    HKQuantityTypeIdentifierDietaryCholesterol: "cholesterol",
    HKQuantityTypeIdentifierDietarySodium: "sodium",
    HKQuantityTypeIdentifierDietaryFiber: "fiber",
    HKQuantityTypeIdentifierDietarySugar: "sugar",
    HKQuantityTypeIdentifierDietaryCalcium: "calcium",
    HKQuantityTypeIdentifierDietaryIron: "iron",
    HKQuantityTypeIdentifierDietaryPotassium: "potassium",
    HKQuantityTypeIdentifierDietaryVitaminA: "vitamin_a",
    HKQuantityTypeIdentifierDietaryVitaminB6: "vitamin_b6",
    HKQuantityTypeIdentifierDietaryVitaminB12: "vitamin_b12",
    HKQuantityTypeIdentifierDietaryVitaminC: "vitamin_c",
    HKQuantityTypeIdentifierDietaryVitaminD: "vitamin_d",
    HKQuantityTypeIdentifierDietaryVitaminE: "vitamin_e",
    HKQuantityTypeIdentifierDietaryVitaminK: "vitamin_k",
    HKQuantityTypeIdentifierDietaryZinc: "zinc",
    HKQuantityTypeIdentifierDietaryMagnesium: "magnesium",
    HKQuantityTypeIdentifierDietaryWater: "water",
    HKQuantityTypeIdentifierDietaryCaffeine: "caffeine",

    // Energy
    HKQuantityTypeIdentifierActiveEnergyBurned: "active_energy_burned",
    HKQuantityTypeIdentifierBasalEnergyBurned: "basal_energy_burned",

    // Vitals
    HKQuantityTypeIdentifierBloodPressureSystolic: "blood_pressure_systolic",
    HKQuantityTypeIdentifierBloodPressureDiastolic: "blood_pressure_diastolic",
    HKQuantityTypeIdentifierRespiratoryRate: "respiratory_rate",
    HKQuantityTypeIdentifierBodyTemperature: "body_temperature",
    HKQuantityTypeIdentifierOxygenSaturation: "oxygen_saturation",
    HKQuantityTypeIdentifierBloodGlucose: "blood_glucose",

    // Sleep
    HKQuantityTypeIdentifierSleepAnalysis: "sleep_analysis",

    // Hearing
    HKQuantityTypeIdentifierEnvironmentalAudioExposure: "audio_exposure",
    HKQuantityTypeIdentifierHeadphoneAudioExposure: "headphone_audio_exposure",

    // Mobility
    HKQuantityTypeIdentifierWalkingSpeed: "walking_speed",
    HKQuantityTypeIdentifierWalkingStepLength: "walking_step_length",
    HKQuantityTypeIdentifierWalkingAsymmetryPercentage: "walking_asymmetry",
    HKQuantityTypeIdentifierWalkingDoubleSupportPercentage: "walking_double_support",
    HKQuantityTypeIdentifierSixMinuteWalkTestDistance: "six_minute_walk_distance",
    HKQuantityTypeIdentifierStairAscentSpeed: "stair_ascent_speed",
    HKQuantityTypeIdentifierStairDescentSpeed: "stair_descent_speed",
    HKQuantityTypeIdentifierAppleWalkingSteadiness: "walking_steadiness",

    // Mindfulness
    HKQuantityTypeIdentifierMindfulSession: "mindful_session",

    // Other
    HKQuantityTypeIdentifierElectrodermalActivity: "electrodermal_activity",
    HKQuantityTypeIdentifierInhalerUsage: "inhaler_usage",
    HKQuantityTypeIdentifierNumberOfTimesFallen: "falls",
    HKQuantityTypeIdentifierUVExposure: "uv_exposure",
  };

  return mapping[appleHealthType] || appleHealthType;
}

/**
 * Normalize Apple Health workout activity type
 * Example: "HKWorkoutActivityTypeRunning" -> "running"
 */
export function normalizeWorkoutType(appleHealthType: string): string {
  // Remove "HKWorkoutActivityType" prefix and convert to lowercase
  return appleHealthType
    .replace("HKWorkoutActivityType", "")
    .replace(/([A-Z])/g, "_$1")
    .toLowerCase()
    .replace(/^_/, "");
}

/**
 * Convert Apple Health unit to standardized unit
 */
export function standardizeUnit(unit: string): string {
  const mapping: Record<string, string> = {
    // Distance
    mi: "km",
    km: "km",
    m: "m",
    ft: "m",
    yd: "m",

    // Energy
    Cal: "kcal",
    kcal: "kcal",
    kJ: "kJ",

    // Mass
    lb: "kg",
    kg: "kg",
    g: "g",
    mg: "mg",
    oz: "g",

    // Time
    min: "min",
    hr: "hr",
    s: "s",

    // Count
    count: "count",

    // Percentage
    "%": "%",

    // Temperature
    "degF": "degC",
    "degC": "degC",

    // Volume
    mL: "mL",
    "fl_oz_us": "mL",
    L: "L",

    // Pressure
    mmHg: "mmHg",

    // Other
    "count/min": "count/min",
    dBASPL: "dBASPL",
    "m/s": "m/s",
    cm: "cm",
  };

  return mapping[unit] || unit;
}
