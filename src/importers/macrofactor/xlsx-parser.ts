import * as XLSX from "xlsx";
import { getDatabase } from "../../db/client";
import type { Nutrition, BodyMetrics, HealthMetric } from "../../types/health";
import { parseExcelDate } from "../../utils/date-utils";
import { logger } from "../../utils/logger";

interface ParseStats {
  nutritionRecords: number;
  bodyRecords: number;
  metricRecords: number;
  errors: string[];
}

export async function parseMacroFactorXLSX(
  userId: number,
  filePath: string
): Promise<ParseStats> {
  logger.startPhase("Parsing MacroFactor XLSX");

  const db = getDatabase();
  const stats: ParseStats = {
    nutritionRecords: 0,
    bodyRecords: 0,
    metricRecords: 0,
    errors: [],
  };

  try {
    // Read the workbook using xlsx library
    const workbook = XLSX.readFile(filePath);

    logger.info(`Workbook loaded with ${workbook.SheetNames.length} sheets`);
    workbook.SheetNames.forEach(name => {
      logger.info(`  Sheet: ${name}`);
    });

    // Parse each sheet
    parseCaloriesAndMacros(workbook, userId, stats);
    parseMicronutrients(workbook, userId, stats);
    parseScaleWeight(workbook, userId, stats);
    parseWeightTrend(workbook, userId, stats);
    parseExpenditure(workbook, userId, stats);
    parseSteps(workbook, userId, stats);
    parseBodyMetrics(workbook, userId, stats);

    logger.endPhase(
      stats.nutritionRecords + stats.bodyRecords + stats.metricRecords
    );
    logger.info(
      `  Nutrition: ${stats.nutritionRecords}, Body: ${stats.bodyRecords}, Metrics: ${stats.metricRecords}`
    );

    return stats;
  } catch (error) {
    logger.error(`Failed to parse XLSX: ${error}`);
    stats.errors.push(String(error));
    return stats;
  }
}

function parseCaloriesAndMacros(
  workbook: XLSX.WorkBook,
  userId: number,
  stats: ParseStats
) {
  const sheetName = "Calories & Macros";
  if (!workbook.Sheets[sheetName]) {
    stats.errors.push(`Sheet '${sheetName}' not found`);
    return;
  }

  const sheet = workbook.Sheets[sheetName];
  const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  const db = getDatabase();
  const insert = db.prepare(`
    INSERT INTO nutrition (
      user_id, date, calories, fat_g, carbs_g, protein_g, source_name
    ) VALUES (?, ?, ?, ?, ?, ?, 'MacroFactor')
    ON CONFLICT(user_id, date) DO UPDATE SET
      calories = excluded.calories,
      fat_g = excluded.fat_g,
      carbs_g = excluded.carbs_g,
      protein_g = excluded.protein_g
  `);

  // Skip header row
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    try {
      const date = parseExcelDate(row[0]);
      if (!date) continue;

      insert.run(
        userId,
        date,
        row[1] || null, // Calories
        row[2] || null, // Fat
        row[3] || null, // Carbs
        row[4] || null  // Protein
      );

      stats.nutritionRecords++;
    } catch (error) {
      stats.errors.push(`Calories row ${i}: ${error}`);
    }
  }

  logger.info(`Parsed ${stats.nutritionRecords} nutrition records`);
}

function parseMicronutrients(
  workbook: XLSX.WorkBook,
  userId: number,
  stats: ParseStats
) {
  const sheetName = "Micronutrients";
  if (!workbook.Sheets[sheetName]) return;

  const sheet = workbook.Sheets[sheetName];
  const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  if (data.length < 2) return;

  const db = getDatabase();
  const headers = data[0];

  // Build column mapping
  const columnMap: Map<number, string> = new Map();

  headers.forEach((header: string, index: number) => {
    const h = String(header).toLowerCase().trim();

    if (h.includes("fiber")) columnMap.set(index, "fiber_g");
    else if (h.includes("calcium")) columnMap.set(index, "calcium_mg");
    else if (h.includes("iron")) columnMap.set(index, "iron_mg");
    else if (h.includes("magnesium")) columnMap.set(index, "magnesium_mg");
    else if (h.includes("potassium")) columnMap.set(index, "potassium_mg");
    else if (h.includes("sodium")) columnMap.set(index, "sodium_mg");
    else if (h.includes("zinc")) columnMap.set(index, "zinc_mg");
    else if (h.includes("vitamin c")) columnMap.set(index, "vitamin_c_mg");
    else if (h.includes("vitamin d")) columnMap.set(index, "vitamin_d_mcg");
    // Add more mappings as needed
  });

  // Process each data row
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    try {
      const date = parseExcelDate(row[0]);
      if (!date) continue;

      const setClauses: string[] = [];
      const values: any[] = [];

      columnMap.forEach((dbCol, excelIdx) => {
        const value = row[excelIdx];
        if (value !== null && value !== undefined && value !== "") {
          setClauses.push(`${dbCol} = ?`);
          values.push(value);
        }
      });

      if (setClauses.length > 0) {
        const query = `
          UPDATE nutrition
          SET ${setClauses.join(", ")}
          WHERE user_id = ? AND date = ?
        `;

        db.prepare(query).run(...values, userId, date);
      }
    } catch (error) {
      stats.errors.push(`Micronutrients row ${i}: ${error}`);
    }
  }

  logger.info("Parsed micronutrients data");
}

function parseScaleWeight(
  workbook: XLSX.WorkBook,
  userId: number,
  stats: ParseStats
) {
  const sheetName = "Scale Weight";
  if (!workbook.Sheets[sheetName]) return;

  const sheet = workbook.Sheets[sheetName];
  const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  const db = getDatabase();
  const insert = db.prepare(`
    INSERT INTO body_metrics (
      user_id, date, weight_lb, body_fat_percent, source_name
    ) VALUES (?, ?, ?, ?, 'MacroFactor')
    ON CONFLICT(user_id, date, source_name) DO UPDATE SET
      weight_lb = excluded.weight_lb,
      body_fat_percent = excluded.body_fat_percent
  `);

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    try {
      const date = parseExcelDate(row[0]);
      if (!date) continue;

      insert.run(
        userId,
        date,
        row[1] || null, // Weight (lb)
        row[2] || null  // Body fat %
      );

      stats.bodyRecords++;
    } catch (error) {
      stats.errors.push(`Scale weight row ${i}: ${error}`);
    }
  }

  logger.info(`Parsed ${stats.bodyRecords} scale weight records`);
}

function parseWeightTrend(
  workbook: XLSX.WorkBook,
  userId: number,
  stats: ParseStats
) {
  const sheetName = "Weight Trend";
  if (!workbook.Sheets[sheetName]) return;

  const sheet = workbook.Sheets[sheetName];
  const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  const db = getDatabase();
  const insert = db.prepare(`
    INSERT INTO health_metrics (
      user_id, metric_type, value, unit, source_name, start_date, end_date
    ) VALUES (?, 'weight_trend', ?, 'lb', 'MacroFactor', ?, ?)
  `);

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    try {
      const date = parseExcelDate(row[0]);
      if (!date) continue;

      const weight = row[1];
      if (!weight) continue;

      insert.run(userId, weight, date, date);
      stats.metricRecords++;
    } catch (error) {
      stats.errors.push(`Weight trend row ${i}: ${error}`);
    }
  }

  logger.info("Parsed weight trend data");
}

function parseExpenditure(
  workbook: XLSX.WorkBook,
  userId: number,
  stats: ParseStats
) {
  const sheetName = "Expenditure";
  if (!workbook.Sheets[sheetName]) return;

  const sheet = workbook.Sheets[sheetName];
  const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  const db = getDatabase();
  const insert = db.prepare(`
    INSERT INTO health_metrics (
      user_id, metric_type, value, unit, source_name, start_date, end_date
    ) VALUES (?, 'tdee', ?, 'kcal', 'MacroFactor', ?, ?)
  `);

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    try {
      const date = parseExcelDate(row[0]);
      if (!date) continue;

      const tdee = row[1];
      if (!tdee) continue;

      insert.run(userId, tdee, date, date);
      stats.metricRecords++;
    } catch (error) {
      stats.errors.push(`Expenditure row ${i}: ${error}`);
    }
  }

  logger.info("Parsed expenditure (TDEE) data");
}

function parseSteps(
  workbook: XLSX.WorkBook,
  userId: number,
  stats: ParseStats
) {
  const sheetName = "Steps";
  if (!workbook.Sheets[sheetName]) return;

  const sheet = workbook.Sheets[sheetName];
  const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  const db = getDatabase();
  const insert = db.prepare(`
    INSERT INTO health_metrics (
      user_id, metric_type, value, unit, source_name, start_date, end_date
    ) VALUES (?, 'steps', ?, 'count', 'MacroFactor', ?, ?)
  `);

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    try {
      const date = parseExcelDate(row[0]);
      if (!date) continue;

      const steps = row[1];
      if (!steps) continue;

      insert.run(userId, steps, date, date);
      stats.metricRecords++;
    } catch (error) {
      stats.errors.push(`Steps row ${i}: ${error}`);
    }
  }

  logger.info("Parsed steps data");
}

function parseBodyMetrics(
  workbook: XLSX.WorkBook,
  userId: number,
  stats: ParseStats
) {
  const sheetName = "Body Metrics";
  if (!workbook.Sheets[sheetName]) return;

  const sheet = workbook.Sheets[sheetName];
  const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  if (data.length < 2) return;

  const db = getDatabase();
  const headers = data[0];

  // Build column mapping
  const columnMap: Map<number, string> = new Map();

  headers.forEach((header: string, index: number) => {
    const h = String(header).toLowerCase().trim();

    if (h.includes("chest")) columnMap.set(index, "chest_cm");
    else if (h.includes("waist")) columnMap.set(index, "waist_cm");
    else if (h.includes("hips")) columnMap.set(index, "hips_cm");
    // Add more mappings as needed
  });

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    try {
      const date = parseExcelDate(row[0]);
      if (!date) continue;

      const setClauses: string[] = [];
      const values: any[] = [];

      columnMap.forEach((dbCol, excelIdx) => {
        const value = row[excelIdx];
        if (value !== null && value !== undefined && value !== "") {
          setClauses.push(`${dbCol} = ?`);
          values.push(value);
        }
      });

      if (setClauses.length > 0) {
        const query = `
          UPDATE body_metrics
          SET ${setClauses.join(", ")}
          WHERE user_id = ? AND date = ? AND source_name = 'MacroFactor'
        `;

        db.prepare(query).run(...values, userId, date);
      }
    } catch (error) {
      stats.errors.push(`Body metrics row ${i}: ${error}`);
    }
  }

  logger.info("Parsed body metrics data");
}
