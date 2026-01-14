import { readdirSync, readFileSync } from "fs";
import { resolve, basename } from "path";
import { getDatabase } from "../../db/client";
import { logger } from "../../utils/logger";
import type { ClinicalRecord } from "../../types/health";

const BATCH_SIZE = 100;

interface ParseStats {
  recordsProcessed: number;
  errors: string[];
}

interface FHIRResource {
  id: string;
  resourceType: string;
  code?: {
    text?: string;
    coding?: Array<{
      code?: string;
      system?: string;
      display?: string;
    }>;
  };
  effectiveDateTime?: string;
  recordedDate?: string;
  onsetDateTime?: string;
  valueQuantity?: {
    value?: number;
    unit?: string;
  };
  valueString?: string;
  status?: string;
  clinicalStatus?: {
    text?: string;
    coding?: Array<{ code?: string }>;
  };
  verificationStatus?: {
    text?: string;
  };
  meta?: {
    lastUpdated?: string;
  };
}

export async function parseFHIRRecords(
  userId: number,
  directoryPath: string
): Promise<ParseStats> {
  logger.startPhase("Parsing FHIR Clinical Records");

  const db = getDatabase();
  const stats: ParseStats = {
    recordsProcessed: 0,
    errors: [],
  };

  // Get all JSON files
  const files = readdirSync(directoryPath).filter((f) => f.endsWith(".json"));
  logger.info(`Found ${files.length} clinical record files`);

  let recordBatch: ClinicalRecord[] = [];

  const insertRecord = db.prepare(`
    INSERT INTO clinical_records (
      user_id, resource_type, resource_id, recorded_date, display_name,
      code, code_system, value_text, value_quantity, value_unit,
      file_path, raw_json, metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, resource_id) DO UPDATE SET
      recorded_date = excluded.recorded_date,
      display_name = excluded.display_name,
      code = excluded.code,
      code_system = excluded.code_system,
      value_text = excluded.value_text,
      value_quantity = excluded.value_quantity,
      value_unit = excluded.value_unit,
      raw_json = excluded.raw_json
  `);

  function flushBatch() {
    if (recordBatch.length === 0) return;

    try {
      db.run("BEGIN TRANSACTION");

      for (const record of recordBatch) {
        insertRecord.run(
          record.user_id,
          record.resource_type,
          record.resource_id,
          record.recorded_date || null,
          record.display_name || null,
          record.code || null,
          record.code_system || null,
          record.value_text || null,
          record.value_quantity || null,
          record.value_unit || null,
          record.file_path,
          record.raw_json || null,
          record.metadata || null
        );
      }

      db.run("COMMIT");
      stats.recordsProcessed += recordBatch.length;
      logger.progress("Clinical records", stats.recordsProcessed, files.length);
    } catch (error) {
      db.run("ROLLBACK");
      stats.errors.push(`Batch insert failed: ${error}`);
    }

    recordBatch = [];
  }

  // Process each file
  for (const file of files) {
    try {
      const filePath = resolve(directoryPath, file);
      const content = readFileSync(filePath, "utf-8");
      const resource: FHIRResource = JSON.parse(content);

      // Extract resource type from filename (e.g., "Observation-UUID.json")
      const resourceType = basename(file).split("-")[0];

      // Extract date - try multiple fields
      const recordedDate =
        resource.effectiveDateTime ||
        resource.recordedDate ||
        resource.onsetDateTime ||
        resource.meta?.lastUpdated;

      // Extract display name from code
      const displayName =
        resource.code?.text ||
        resource.code?.coding?.[0]?.display ||
        resource.clinicalStatus?.text ||
        resource.status;

      // Extract code and system
      const coding = resource.code?.coding?.[0];
      const code = coding?.code;
      const codeSystem = coding?.system;

      // Extract value
      let valueText: string | undefined;
      let valueQuantity: number | undefined;
      let valueUnit: string | undefined;

      if (resource.valueQuantity) {
        valueQuantity = resource.valueQuantity.value;
        valueUnit = resource.valueQuantity.unit;
      } else if (resource.valueString) {
        valueText = resource.valueString;
      } else if (resource.clinicalStatus?.text) {
        valueText = resource.clinicalStatus.text;
      } else if (resource.verificationStatus?.text) {
        valueText = resource.verificationStatus.text;
      }

      recordBatch.push({
        user_id: userId,
        resource_type: resourceType,
        resource_id: resource.id,
        recorded_date: recordedDate,
        display_name: displayName,
        code,
        code_system: codeSystem,
        value_text: valueText,
        value_quantity: valueQuantity,
        value_unit: valueUnit,
        file_path: filePath,
        raw_json: content,
      });

      if (recordBatch.length >= BATCH_SIZE) {
        flushBatch();
      }
    } catch (error) {
      stats.errors.push(`Failed to parse ${file}: ${error}`);
    }
  }

  // Flush remaining records
  flushBatch();

  logger.endPhase(stats.recordsProcessed);

  return stats;
}
