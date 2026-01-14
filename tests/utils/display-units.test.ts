import { describe, expect, test } from "bun:test";
import {
  kgToLbs,
  lbsToKg,
  kmToMiles,
  milesToKm,
  formatWeight,
  formatDistance,
} from "../../src/utils/display-units";

describe("Display Units", () => {
  describe("kgToLbs", () => {
    test("converts kg to lbs correctly", () => {
      expect(kgToLbs(100)).toBeCloseTo(220.462, 2);
      expect(kgToLbs(68)).toBeCloseTo(149.914, 2);
      expect(kgToLbs(211.858)).toBeCloseTo(467.1, 1);
    });

    test("handles zero", () => {
      expect(kgToLbs(0)).toBe(0);
    });
  });

  describe("lbsToKg", () => {
    test("converts lbs to kg correctly", () => {
      expect(lbsToKg(220.462)).toBeCloseTo(100, 2);
      expect(lbsToKg(150)).toBeCloseTo(68.04, 2);
    });

    test("handles zero", () => {
      expect(lbsToKg(0)).toBe(0);
    });
  });

  describe("kmToMiles", () => {
    test("converts km to miles correctly", () => {
      expect(kmToMiles(10)).toBeCloseTo(6.214, 2);
      expect(kmToMiles(5)).toBeCloseTo(3.107, 2);
    });

    test("handles zero", () => {
      expect(kmToMiles(0)).toBe(0);
    });
  });

  describe("milesToKm", () => {
    test("converts miles to km correctly", () => {
      expect(milesToKm(6.214)).toBeCloseTo(10, 2);
      expect(milesToKm(10)).toBeCloseTo(16.09, 2);
    });

    test("handles zero", () => {
      expect(milesToKm(0)).toBe(0);
    });
  });

  describe("formatWeight", () => {
    test("formats weight in lbs by default", () => {
      expect(formatWeight(100)).toBe("220.5 lbs");
      expect(formatWeight(68)).toBe("149.9 lbs");
    });

    test("formats weight in kg when specified", () => {
      expect(formatWeight(100, "kg")).toBe("100.0 kg");
      expect(formatWeight(68.5, "kg")).toBe("68.5 kg");
    });

    test("formats weight in lbs when explicitly specified", () => {
      expect(formatWeight(211.858, "lbs")).toBe("467.1 lbs");
    });
  });

  describe("formatDistance", () => {
    test("formats distance in km by default", () => {
      expect(formatDistance(10)).toBe("10.0 km");
      expect(formatDistance(5.5)).toBe("5.5 km");
    });

    test("formats distance in miles when specified", () => {
      expect(formatDistance(10, "miles")).toBe("6.2 mi");
      expect(formatDistance(16.09, "miles")).toBe("10.0 mi");
    });
  });
});
