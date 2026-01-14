import { existsSync, readdirSync } from "fs";
import { resolve } from "path";
import { parseMacroFactorXLSX } from "./xlsx-parser";
import { logger } from "../../utils/logger";

export interface MacroFactorImportOptions {
  userId: number;
  username: string;
  dataPath?: string;
}

export interface MacroFactorImportResult {
  success: boolean;
  recordsImported: number;
  errors: string[];
}

export async function importMacroFactor(
  options: MacroFactorImportOptions
): Promise<MacroFactorImportResult> {
  const {
    userId,
    username,
    dataPath = resolve(import.meta.dir, "../../../health-data"),
  } = options;

  const macroFactorPath = resolve(dataPath, username, "macrofactor");

  logger.startPhase(`Importing MacroFactor data for ${username}`);

  // Check if directory exists
  if (!existsSync(macroFactorPath)) {
    logger.warn(`MacroFactor directory not found at: ${macroFactorPath}`);
    return {
      success: false,
      recordsImported: 0,
      errors: [`MacroFactor directory not found at ${macroFactorPath}`],
    };
  }

  // Find XLSX files
  const files = readdirSync(macroFactorPath).filter(
    (f) => f.startsWith("MacroFactor-") && f.endsWith(".xlsx")
  );

  if (files.length === 0) {
    logger.warn("No MacroFactor XLSX files found");
    return {
      success: false,
      recordsImported: 0,
      errors: ["No MacroFactor XLSX files found"],
    };
  }

  // Use the most recent file (sorted by name, which includes date)
  const latestFile = files.sort().reverse()[0];
  const xlsxPath = resolve(macroFactorPath, latestFile);

  logger.info(`Found MacroFactor export: ${latestFile}`);

  try {
    const stats = await parseMacroFactorXLSX(userId, xlsxPath);

    const totalRecords =
      stats.nutritionRecords + stats.bodyRecords + stats.metricRecords;

    logger.success(
      `MacroFactor import completed: ${totalRecords.toLocaleString()} records`
    );

    return {
      success: stats.errors.length === 0,
      recordsImported: totalRecords,
      errors: stats.errors,
    };
  } catch (error) {
    logger.error(`MacroFactor import failed: ${error}`);
    return {
      success: false,
      recordsImported: 0,
      errors: [String(error)],
    };
  }
}
