import { existsSync } from "fs";
import { resolve } from "path";
import { parseAppleHealthXML } from "./xml-parser";
import { logger } from "../../utils/logger";

export interface AppleHealthImportOptions {
  userId: number;
  username: string;
  dataPath?: string;
}

export interface AppleHealthImportResult {
  success: boolean;
  recordsImported: number;
  errors: string[];
}

export async function importAppleHealth(
  options: AppleHealthImportOptions
): Promise<AppleHealthImportResult> {
  const {
    userId,
    username,
    dataPath = resolve(import.meta.dir, "../../../health-data"),
  } = options;

  const appleHealthPath = resolve(dataPath, username, "apple-health");
  const exportXmlPath = resolve(appleHealthPath, "export.xml");

  logger.startPhase(`Importing Apple Health data for ${username}`);

  // Check if export.xml exists
  if (!existsSync(exportXmlPath)) {
    logger.error(`Apple Health export.xml not found at: ${exportXmlPath}`);
    return {
      success: false,
      recordsImported: 0,
      errors: [`export.xml not found at ${exportXmlPath}`],
    };
  }

  logger.info(`Found export.xml at: ${exportXmlPath}`);

  try {
    // Parse the main export.xml file
    const xmlStats = await parseAppleHealthXML(userId, exportXmlPath);

    const totalRecords =
      xmlStats.recordsProcessed +
      xmlStats.workoutsProcessed +
      xmlStats.activitiesProcessed;

    logger.success(
      `Apple Health import completed: ${totalRecords.toLocaleString()} records`
    );

    return {
      success: xmlStats.errors.length === 0,
      recordsImported: totalRecords,
      errors: xmlStats.errors,
    };
  } catch (error) {
    logger.error(`Apple Health import failed: ${error}`);
    return {
      success: false,
      recordsImported: 0,
      errors: [String(error)],
    };
  }
}
