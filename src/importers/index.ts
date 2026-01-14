import { getOrCreateUser, recordImport } from "../db/queries";
import { importAppleHealth } from "./apple-health";
import { importMacroFactor } from "./macrofactor";
import { logger } from "../utils/logger";
import type { ImportResult } from "../types/health";

export interface ImportOptions {
  username: string;
  dataPath?: string;
  skipAppleHealth?: boolean;
  skipMacroFactor?: boolean;
}

export async function importHealthData(
  options: ImportOptions
): Promise<ImportResult> {
  const { username, dataPath, skipAppleHealth = false, skipMacroFactor = false } = options;

  logger.info(`\n${"=".repeat(60)}`);
  logger.info(`  Vitals Health Data Import`);
  logger.info(`  User: ${username}`);
  logger.info(`${"=".repeat(60)}\n`);

  const startTime = Date.now();
  let totalRecords = 0;
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Get or create user
    const user = getOrCreateUser(username, username);
    logger.success(`User initialized: ${user.display_name} (ID: ${user.id})`);

    // Import Apple Health data
    if (!skipAppleHealth) {
      const appleHealthResult = await importAppleHealth({
        userId: user.id,
        username,
        dataPath,
      });

      totalRecords += appleHealthResult.recordsImported;
      errors.push(...appleHealthResult.errors);

      if (appleHealthResult.success) {
        recordImport(
          user.id,
          "apple-health",
          "export.xml",
          appleHealthResult.recordsImported,
          "success"
        );
      } else {
        recordImport(
          user.id,
          "apple-health",
          "export.xml",
          appleHealthResult.recordsImported,
          "failed",
          appleHealthResult.errors.join("\n")
        );
      }
    }

    // Import MacroFactor data
    if (!skipMacroFactor) {
      const macroFactorResult = await importMacroFactor({
        userId: user.id,
        username,
        dataPath,
      });

      totalRecords += macroFactorResult.recordsImported;
      errors.push(...macroFactorResult.errors);

      if (macroFactorResult.success) {
        recordImport(
          user.id,
          "macrofactor",
          "MacroFactor-*.xlsx",
          macroFactorResult.recordsImported,
          "success"
        );
      } else {
        recordImport(
          user.id,
          "macrofactor",
          "MacroFactor-*.xlsx",
          macroFactorResult.recordsImported,
          macroFactorResult.errors.length > 0 ? "failed" : "partial",
          macroFactorResult.errors.join("\n")
        );
      }
    }

    // Summary
    const timeTaken = (Date.now() - startTime) / 1000;

    logger.info(`\n${"=".repeat(60)}`);
    logger.info(`  Import Summary`);
    logger.info(`${"=".repeat(60)}`);
    logger.success(`Total records imported: ${totalRecords.toLocaleString()}`);
    logger.info(`Time taken: ${formatDuration(timeTaken)}`);

    if (errors.length > 0) {
      logger.warn(`Errors encountered: ${errors.length}`);
      errors.slice(0, 5).forEach((err) => logger.error(`  ${err}`));
      if (errors.length > 5) {
        logger.warn(`  ... and ${errors.length - 5} more errors`);
      }
    } else {
      logger.success("No errors encountered");
    }

    logger.info(`${"=".repeat(60)}\n`);

    return {
      success: errors.length === 0,
      recordsImported: totalRecords,
      errors,
      warnings,
      timeTaken,
    };
  } catch (error) {
    logger.error(`\nImport failed: ${error}`);
    return {
      success: false,
      recordsImported: totalRecords,
      errors: [String(error)],
      warnings,
      timeTaken: (Date.now() - startTime) / 1000,
    };
  }
}

function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  return `${minutes}m ${remainingSeconds}s`;
}
