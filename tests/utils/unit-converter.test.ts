import { describe, test, expect } from "bun:test";
import {
  lbsToKg,
  kgToLbs,
  milesToKm,
  kmToMiles,
  kcalToKj,
  kjToKcal,
  inchesToCm,
  cmToInches,
  metersToKm,
  mlToOz,
  ozToMl,
  normalizeMetricType,
  normalizeWorkoutType,
  standardizeUnit,
} from "../../src/utils/unit-converter";

describe("unit-converter", () => {
  describe("weight conversions", () => {
    test("converts pounds to kilograms", () => {
      expect(lbsToKg(100)).toBeCloseTo(45.359, 2);
      expect(lbsToKg(150)).toBeCloseTo(68.039, 2);
    });

    test("converts kilograms to pounds", () => {
      expect(kgToLbs(45.359)).toBeCloseTo(100, 2);
      expect(kgToLbs(68.039)).toBeCloseTo(150, 2);
    });

    test("weight conversions are reversible", () => {
      const originalLbs = 175;
      expect(kgToLbs(lbsToKg(originalLbs))).toBeCloseTo(originalLbs, 2);
    });
  });

  describe("distance conversions", () => {
    test("converts miles to kilometers", () => {
      expect(milesToKm(1)).toBeCloseTo(1.609, 2);
      expect(milesToKm(5)).toBeCloseTo(8.047, 2);
    });

    test("converts kilometers to miles", () => {
      expect(kmToMiles(1.609)).toBeCloseTo(1, 2);
      expect(kmToMiles(10)).toBeCloseTo(6.214, 2);
    });

    test("converts meters to kilometers", () => {
      expect(metersToKm(1000)).toBe(1);
      expect(metersToKm(5000)).toBe(5);
    });
  });

  describe("energy conversions", () => {
    test("converts kcal to kJ", () => {
      expect(kcalToKj(100)).toBeCloseTo(418.4, 1);
    });

    test("converts kJ to kcal", () => {
      expect(kjToKcal(418.4)).toBeCloseTo(100, 1);
    });
  });

  describe("length conversions", () => {
    test("converts inches to centimeters", () => {
      expect(inchesToCm(12)).toBeCloseTo(30.48, 2);
    });

    test("converts centimeters to inches", () => {
      expect(cmToInches(30.48)).toBeCloseTo(12, 2);
    });
  });

  describe("volume conversions", () => {
    test("converts ml to oz", () => {
      expect(mlToOz(100)).toBeCloseTo(3.381, 2);
    });

    test("converts oz to ml", () => {
      expect(ozToMl(8)).toBeCloseTo(236.588, 2);
    });
  });

  describe("normalizeMetricType", () => {
    test("normalizes common metric types", () => {
      expect(normalizeMetricType("HKQuantityTypeIdentifierStepCount")).toBe("steps");
      expect(normalizeMetricType("HKQuantityTypeIdentifierHeartRate")).toBe("heart_rate");
      expect(normalizeMetricType("HKQuantityTypeIdentifierBodyMass")).toBe("weight");
      expect(normalizeMetricType("HKQuantityTypeIdentifierActiveEnergyBurned")).toBe(
        "active_energy_burned"
      );
    });

    test("normalizes nutrition types", () => {
      expect(normalizeMetricType("HKQuantityTypeIdentifierDietaryProtein")).toBe("protein");
      expect(normalizeMetricType("HKQuantityTypeIdentifierDietaryCarbohydrates")).toBe("carbs");
      expect(normalizeMetricType("HKQuantityTypeIdentifierDietaryFatTotal")).toBe("fat");
    });

    test("returns original for unknown types", () => {
      const unknown = "UnknownType";
      expect(normalizeMetricType(unknown)).toBe(unknown);
    });
  });

  describe("normalizeWorkoutType", () => {
    test("normalizes workout types", () => {
      expect(normalizeWorkoutType("HKWorkoutActivityTypeRunning")).toBe("running");
      expect(normalizeWorkoutType("HKWorkoutActivityTypeWalking")).toBe("walking");
      expect(normalizeWorkoutType("HKWorkoutActivityTypeCycling")).toBe("cycling");
      expect(normalizeWorkoutType("HKWorkoutActivityTypeYoga")).toBe("yoga");
    });
  });

  describe("standardizeUnit", () => {
    test("standardizes distance units", () => {
      expect(standardizeUnit("mi")).toBe("km");
      expect(standardizeUnit("km")).toBe("km");
      expect(standardizeUnit("m")).toBe("m");
    });

    test("standardizes weight units", () => {
      expect(standardizeUnit("lb")).toBe("kg");
      expect(standardizeUnit("kg")).toBe("kg");
    });

    test("standardizes energy units", () => {
      expect(standardizeUnit("Cal")).toBe("kcal");
      expect(standardizeUnit("kcal")).toBe("kcal");
    });

    test("returns original for unknown units", () => {
      expect(standardizeUnit("unknownUnit")).toBe("unknownUnit");
    });
  });
});
