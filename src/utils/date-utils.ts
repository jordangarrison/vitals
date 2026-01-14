/**
 * Date parsing and formatting utilities
 */

/**
 * Parse Apple Health date format (ISO 8601 with timezone)
 * Example: "2024-12-15 10:30:45 -0600"
 */
export function parseAppleHealthDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString();

  // Apple Health uses format: "YYYY-MM-DD HH:MM:SS ±HHMM"
  // Convert to ISO 8601 format for SQLite
  const parts = dateStr.trim().split(" ");

  if (parts.length === 3) {
    const [date, time, timezone] = parts;

    // Convert timezone from ±HHMM to ±HH:MM
    const tzHours = timezone.slice(0, 3);
    const tzMinutes = timezone.slice(3);
    const formattedTz = `${tzHours}:${tzMinutes}`;

    return `${date}T${time}${formattedTz}`;
  }

  // Fallback: try to parse as-is
  return new Date(dateStr).toISOString();
}

/**
 * Parse Excel/MacroFactor date (can be Date object or string)
 */
export function parseExcelDate(date: any): string {
  if (!date) return "";

  if (date instanceof Date) {
    return date.toISOString().split("T")[0]; // YYYY-MM-DD
  }

  if (typeof date === "string") {
    // Try to parse the string
    const parsed = new Date(date);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split("T")[0];
    }
    return date; // Return as-is if it looks like YYYY-MM-DD
  }

  if (typeof date === "number") {
    // Excel serial date number
    return excelSerialToDate(date);
  }

  return "";
}

/**
 * Convert Excel serial date number to ISO date string
 * Excel dates are days since 1900-01-01 (with some quirks)
 */
function excelSerialToDate(serial: number): string {
  // Excel incorrectly considers 1900 a leap year
  const excelEpoch = new Date(1899, 11, 30); // Dec 30, 1899
  const days = Math.floor(serial);
  const ms = days * 24 * 60 * 60 * 1000;
  const date = new Date(excelEpoch.getTime() + ms);

  return date.toISOString().split("T")[0];
}

/**
 * Get date string in YYYY-MM-DD format
 */
export function formatDate(date: Date | string): string {
  if (typeof date === "string") {
    return date.split("T")[0];
  }
  return date.toISOString().split("T")[0];
}

/**
 * Calculate duration in hours between two date strings
 */
export function calculateDurationHours(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = end.getTime() - start.getTime();
  return diffMs / (1000 * 60 * 60);
}

/**
 * Calculate duration in minutes between two date strings
 */
export function calculateDurationMinutes(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = end.getTime() - start.getTime();
  return diffMs / (1000 * 60);
}

/**
 * Parse Apple Health duration string (e.g., "45 min", "1.5 hr")
 */
export function parseDuration(duration: string, unit: string): number | undefined {
  if (!duration || !unit) return undefined;

  const value = parseFloat(duration);
  if (isNaN(value)) return undefined;

  // Convert to minutes
  if (unit === "min") {
    return value;
  } else if (unit === "hr") {
    return value * 60;
  }

  return undefined;
}

/**
 * Get today's date in YYYY-MM-DD format
 */
export function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Check if a date string is valid
 */
export function isValidDate(dateStr: string): boolean {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}
