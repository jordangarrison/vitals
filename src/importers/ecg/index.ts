import { existsSync } from "fs";
import { resolve } from "path";
import { parseECGRecordings } from "./csv-parser";
import { logger } from "../../utils/logger";
import type { ImportResult } from "../../types/health";

export interface ECGImportOptions {
  userId: number;
  username: string;
  dataPath?: string;
}

export async function importECGRecordings(
  options: ECGImportOptions
): Promise<ImportResult> {
  const { userId, username, dataPath } = options;
  const basePath = dataPath || resolve(process.cwd(), "health-data");
  const ecgPath = resolve(
    basePath,
    username,
    "apple-health",
    "electrocardiograms"
  );

  logger.info(`\nImporting ECG Recordings...`);

  if (!existsSync(ecgPath)) {
    logger.warn(`ECG directory not found: ${ecgPath}`);
    return {
      success: true,
      recordsImported: 0,
      errors: [],
      warnings: [`ECG directory not found`],
      timeTaken: 0,
    };
  }

  const startTime = Date.now();

  try {
    const stats = await parseECGRecordings(userId, ecgPath);
    const timeTaken = (Date.now() - startTime) / 1000;

    logger.success(
      `Imported ${stats.recordsProcessed.toLocaleString()} ECG recordings`
    );

    return {
      success: stats.errors.length === 0,
      recordsImported: stats.recordsProcessed,
      errors: stats.errors,
      warnings: [],
      timeTaken,
    };
  } catch (error) {
    logger.error(`ECG import failed: ${error}`);
    return {
      success: false,
      recordsImported: 0,
      errors: [String(error)],
      warnings: [],
      timeTaken: (Date.now() - startTime) / 1000,
    };
  }
}
