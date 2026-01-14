/**
 * Display unit conversions for the UI
 * Database stores in metric (kg, km), but displays default to imperial (lbs, miles)
 */

export function kgToLbs(kg: number): number {
  return kg * 2.20462;
}

export function lbsToKg(lbs: number): number {
  return lbs / 2.20462;
}

export function kmToMiles(km: number): number {
  return km * 0.621371;
}

export function milesToKm(miles: number): number {
  return miles / 0.621371;
}

export function formatWeight(kg: number, preferredUnit: "kg" | "lbs" = "lbs"): string {
  if (preferredUnit === "lbs") {
    return `${kgToLbs(kg).toFixed(1)} lbs`;
  }
  return `${kg.toFixed(1)} kg`;
}

export function formatDistance(km: number, preferredUnit: "km" | "miles" = "miles"): string {
  if (preferredUnit === "miles") {
    return `${kmToMiles(km).toFixed(1)} mi`;
  }
  return `${km.toFixed(1)} km`;
}

/**
 * Convert metric value to imperial for display
 * Detects metric type and unit to determine conversion
 */
export function convertToImperial(
  value: number,
  metricType: string,
  unit: string
): { value: number; unit: string } {
  // Weight conversions
  if (unit === "kg" || metricType.includes("weight") || metricType.includes("mass")) {
    return { value: kgToLbs(value), unit: "lbs" };
  }

  // Distance conversions
  if (unit === "km" || metricType.includes("distance")) {
    return { value: kmToMiles(value), unit: "mi" };
  }

  if (unit === "m" && !metricType.includes("min")) {
    // meters to feet, but not "minutes"
    return { value: value * 3.28084, unit: "ft" };
  }

  // No conversion needed
  return { value, unit };
}
