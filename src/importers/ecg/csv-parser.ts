import { readdirSync, readFileSync } from "fs";
import { resolve } from "path";
import { getDatabase } from "../../db/client";
import { logger } from "../../utils/logger";
import type { ECGRecording } from "../../types/health";

interface ParseStats {
  recordsProcessed: number;
  errors: string[];
}

interface ECGMetadata {
  name?: string;
  dateOfBirth?: string;
  recordedDate?: string;
  classification?: string;
  symptoms?: string;
  softwareVersion?: string;
  device?: string;
  sampleRate?: number;
  lead?: string;
  unit?: string;
}

function parseECGCSV(content: string): {
  metadata: ECGMetadata;
  waveform: number[];
} {
  const lines = content.split("\n");
  const metadata: ECGMetadata = {};
  const waveform: number[] = [];
  let inDataSection = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      continue;
    }

    // Check if we've reached the data section (after Unit line)
    if (inDataSection) {
      const value = parseFloat(trimmed);
      if (!isNaN(value)) {
        waveform.push(value);
      }
      continue;
    }

    // Parse metadata
    if (trimmed.startsWith("Name,")) {
      metadata.name = trimmed.substring(5).replace(/"/g, "").trim();
    } else if (trimmed.startsWith("Date of Birth,")) {
      metadata.dateOfBirth = trimmed.substring(14).replace(/"/g, "").trim();
    } else if (trimmed.startsWith("Recorded Date,")) {
      metadata.recordedDate = trimmed.substring(14).replace(/"/g, "").trim();
    } else if (trimmed.startsWith("Classification,")) {
      metadata.classification = trimmed.substring(15).replace(/"/g, "").trim();
    } else if (trimmed.startsWith("Symptoms,")) {
      metadata.symptoms = trimmed.substring(9).replace(/"/g, "").trim() || undefined;
    } else if (trimmed.startsWith("Software Version,")) {
      metadata.softwareVersion = trimmed.substring(17).replace(/"/g, "").trim();
    } else if (trimmed.startsWith("Device,")) {
      metadata.device = trimmed.substring(7).replace(/"/g, "").trim();
    } else if (trimmed.startsWith("Sample Rate,")) {
      const rateStr = trimmed.substring(12).replace(/"/g, "").trim();
      const match = rateStr.match(/(\d+(?:\.\d+)?)/);
      if (match) {
        metadata.sampleRate = parseFloat(match[1]);
      }
    } else if (trimmed.startsWith("Lead,")) {
      metadata.lead = trimmed.substring(5).replace(/"/g, "").trim();
    } else if (trimmed.startsWith("Unit,")) {
      metadata.unit = trimmed.substring(5).replace(/"/g, "").trim();
      inDataSection = true; // Data starts after this line
    }
  }

  return { metadata, waveform };
}

function parseAppleDate(dateStr: string): string {
  // Parse date like "2022-11-15 19:32:03 -0600"
  try {
    const date = new Date(dateStr.replace(" ", "T").replace(" ", ""));
    return date.toISOString();
  } catch {
    // Try alternate parsing
    const parts = dateStr.split(" ");
    if (parts.length >= 2) {
      return new Date(`${parts[0]}T${parts[1]}`).toISOString();
    }
    return dateStr;
  }
}

export async function parseECGRecordings(
  userId: number,
  directoryPath: string
): Promise<ParseStats> {
  logger.startPhase("Parsing ECG Recordings");

  const db = getDatabase();
  const stats: ParseStats = {
    recordsProcessed: 0,
    errors: [],
  };

  // Get all CSV files
  const files = readdirSync(directoryPath).filter((f) => f.endsWith(".csv"));
  logger.info(`Found ${files.length} ECG files`);

  const insertECG = db.prepare(`
    INSERT INTO ecg_recordings (
      user_id, recorded_date, classification, symptoms,
      average_heart_rate, software_version, device,
      sample_rate_hz, file_path, waveform_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const file of files) {
    try {
      const filePath = resolve(directoryPath, file);
      const content = readFileSync(filePath, "utf-8");
      const { metadata, waveform } = parseECGCSV(content);

      if (!metadata.recordedDate) {
        stats.errors.push(`${file}: Missing recorded date`);
        continue;
      }

      const recordedDate = parseAppleDate(metadata.recordedDate);

      // Compress waveform by storing only every Nth point for large recordings
      // Full 30 seconds at 512 Hz = 15,360 points
      // Store decimated version for performance (every 4th point = ~3,840 points)
      const decimationFactor = waveform.length > 5000 ? 4 : 1;
      const decimatedWaveform = waveform.filter(
        (_, i) => i % decimationFactor === 0
      );

      insertECG.run(
        userId,
        recordedDate,
        metadata.classification || null,
        metadata.symptoms || null,
        null, // average_heart_rate - could calculate from waveform
        metadata.softwareVersion || null,
        metadata.device || null,
        metadata.sampleRate || 512,
        filePath,
        JSON.stringify(decimatedWaveform)
      );

      stats.recordsProcessed++;
      logger.progress("ECG recordings", stats.recordsProcessed, files.length);
    } catch (error) {
      stats.errors.push(`Failed to parse ${file}: ${error}`);
    }
  }

  logger.endPhase(stats.recordsProcessed);

  return stats;
}
