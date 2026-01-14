import { describe, test, expect } from "bun:test";
import {
  parseAppleHealthDate,
  parseExcelDate,
  formatDate,
  calculateDurationHours,
  calculateDurationMinutes,
  parseDuration,
  getToday,
  isValidDate,
} from "../../src/utils/date-utils";

describe("date-utils", () => {
  describe("parseAppleHealthDate", () => {
    test("parses Apple Health date format correctly", () => {
      const input = "2024-12-15 10:30:45 -0600";
      const result = parseAppleHealthDate(input);
      expect(result).toBe("2024-12-15T10:30:45-06:00");
    });

    test("parses Apple Health date with positive timezone", () => {
      const input = "2024-12-15 10:30:45 +0530";
      const result = parseAppleHealthDate(input);
      expect(result).toBe("2024-12-15T10:30:45+05:30");
    });

    test("handles empty string", () => {
      const result = parseAppleHealthDate("");
      expect(isValidDate(result)).toBe(true);
    });
  });

  describe("parseExcelDate", () => {
    test("parses Date object", () => {
      const date = new Date("2024-12-15");
      const result = parseExcelDate(date);
      expect(result).toBe("2024-12-15");
    });

    test("parses date string", () => {
      const result = parseExcelDate("2024-12-15");
      expect(result).toBe("2024-12-15");
    });

    test("handles Excel serial number", () => {
      // Excel serial 45292 = 2024-01-01
      const result = parseExcelDate(45292);
      expect(result).toBe("2024-01-01");
    });

    test("handles null/undefined", () => {
      expect(parseExcelDate(null)).toBe("");
      expect(parseExcelDate(undefined)).toBe("");
    });
  });

  describe("formatDate", () => {
    test("formats Date object", () => {
      const date = new Date("2024-12-15T10:30:45Z");
      const result = formatDate(date);
      expect(result).toBe("2024-12-15");
    });

    test("formats ISO string", () => {
      const result = formatDate("2024-12-15T10:30:45Z");
      expect(result).toBe("2024-12-15");
    });
  });

  describe("calculateDurationHours", () => {
    test("calculates duration correctly", () => {
      const start = "2024-12-15T10:00:00Z";
      const end = "2024-12-15T12:30:00Z";
      const result = calculateDurationHours(start, end);
      expect(result).toBe(2.5);
    });

    test("handles overnight duration", () => {
      const start = "2024-12-15T22:00:00Z";
      const end = "2024-12-16T02:00:00Z";
      const result = calculateDurationHours(start, end);
      expect(result).toBe(4);
    });
  });

  describe("calculateDurationMinutes", () => {
    test("calculates minutes correctly", () => {
      const start = "2024-12-15T10:00:00Z";
      const end = "2024-12-15T10:45:00Z";
      const result = calculateDurationMinutes(start, end);
      expect(result).toBe(45);
    });
  });

  describe("parseDuration", () => {
    test("parses minutes", () => {
      const result = parseDuration("45", "min");
      expect(result).toBe(45);
    });

    test("parses hours to minutes", () => {
      const result = parseDuration("2.5", "hr");
      expect(result).toBe(150);
    });

    test("handles invalid input", () => {
      expect(parseDuration("", "min")).toBeUndefined();
      expect(parseDuration("abc", "min")).toBeUndefined();
      expect(parseDuration("45", "")).toBeUndefined();
    });
  });

  describe("getToday", () => {
    test("returns date in YYYY-MM-DD format", () => {
      const result = getToday();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe("isValidDate", () => {
    test("validates correct dates", () => {
      expect(isValidDate("2024-12-15")).toBe(true);
      expect(isValidDate("2024-12-15T10:30:45Z")).toBe(true);
    });

    test("rejects invalid dates", () => {
      expect(isValidDate("")).toBe(false);
      expect(isValidDate("not-a-date")).toBe(false);
      expect(isValidDate("2024-13-45")).toBe(false);
    });
  });
});
