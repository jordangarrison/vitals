import { existsSync } from "fs";
import { resolve } from "path";
import { parseFHIRRecords } from "./fhir-parser";
import { logger } from "../../utils/logger";
import type { ImportResult } from "../../types/health";

export interface ClinicalRecordsImportOptions {
  userId: number;
  username: string;
  dataPath?: string;
}

export async function importClinicalRecords(
  options: ClinicalRecordsImportOptions
): Promise<ImportResult> {
  const { userId, username, dataPath } = options;
  const basePath = dataPath || resolve(process.cwd(), "health-data");
  const clinicalRecordsPath = resolve(
    basePath,
    username,
    "apple-health",
    "clinical-records"
  );

  logger.info(`\nImporting Clinical Records...`);

  if (!existsSync(clinicalRecordsPath)) {
    logger.info(`No clinical records found (optional)`);
    return {
      success: true,
      recordsImported: 0,
      errors: [],
      warnings: [],
      timeTaken: 0,
    };
  }

  const startTime = Date.now();

  try {
    const stats = await parseFHIRRecords(userId, clinicalRecordsPath);
    const timeTaken = (Date.now() - startTime) / 1000;

    logger.success(
      `Imported ${stats.recordsProcessed.toLocaleString()} clinical records`
    );

    return {
      success: stats.errors.length === 0,
      recordsImported: stats.recordsProcessed,
      errors: stats.errors,
      warnings: [],
      timeTaken,
    };
  } catch (error) {
    logger.error(`Clinical records import failed: ${error}`);
    return {
      success: false,
      recordsImported: 0,
      errors: [String(error)],
      warnings: [],
      timeTaken: (Date.now() - startTime) / 1000,
    };
  }
}
