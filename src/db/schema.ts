import { Database } from "bun:sqlite";
import { resolve } from "path";

const DB_PATH =
  process.env.NODE_ENV === "test"
    ? resolve(import.meta.dir, "../../data/test-vitals.db")
    : resolve(import.meta.dir, "../../data/vitals.db");

export function initializeDatabase(dbPath?: string): Database {
  const db = new Database(dbPath || DB_PATH, { create: true });

  // Enable foreign keys and performance optimizations
  db.run("PRAGMA foreign_keys = ON");
  db.run("PRAGMA journal_mode = WAL");
  db.run("PRAGMA synchronous = NORMAL");
  db.run("PRAGMA cache_size = 10000");
  db.run("PRAGMA temp_store = MEMORY");

  console.log("Creating database schema...");

  // Users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // User profile (health data from Apple Health)
  db.run(`
    CREATE TABLE IF NOT EXISTS user_profile (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      date_of_birth TEXT NOT NULL,
      biological_sex TEXT,
      blood_type TEXT,
      fitzpatrick_skin_type TEXT,
      cardio_fitness_medications_use TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id)
    )
  `);

  // Health metrics (4.6M+ records from Apple Health + MacroFactor)
  db.run(`
    CREATE TABLE IF NOT EXISTS health_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      metric_type TEXT NOT NULL,
      value REAL NOT NULL,
      unit TEXT NOT NULL,
      source_name TEXT NOT NULL,
      source_version TEXT,
      device TEXT,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      creation_date TEXT,
      metadata TEXT,
      UNIQUE(user_id, metric_type, start_date, end_date, source_name) ON CONFLICT REPLACE
    )
  `);

  db.run("CREATE INDEX IF NOT EXISTS idx_metrics_user ON health_metrics(user_id)");
  db.run("CREATE INDEX IF NOT EXISTS idx_metrics_type_date ON health_metrics(metric_type, start_date)");
  db.run("CREATE INDEX IF NOT EXISTS idx_metrics_source ON health_metrics(source_name)");
  db.run("CREATE INDEX IF NOT EXISTS idx_metrics_creation ON health_metrics(creation_date)");

  // Nutrition data (146 days from MacroFactor)
  db.run(`
    CREATE TABLE IF NOT EXISTS nutrition (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      date TEXT NOT NULL,
      calories REAL,
      protein_g REAL,
      carbs_g REAL,
      fat_g REAL,
      fiber_g REAL,
      -- Micronutrients (52 columns)
      calcium_mg REAL,
      chloride_mg REAL,
      cholesterol_mg REAL,
      chromium_mcg REAL,
      copper_mg REAL,
      folate_mcg REAL,
      iodine_mcg REAL,
      iron_mg REAL,
      magnesium_mg REAL,
      manganese_mg REAL,
      molybdenum_mcg REAL,
      niacin_mg REAL,
      omega_3_g REAL,
      omega_6_g REAL,
      pantothenic_acid_mg REAL,
      phosphorus_mg REAL,
      potassium_mg REAL,
      riboflavin_mg REAL,
      selenium_mcg REAL,
      sodium_mg REAL,
      thiamin_mg REAL,
      vitamin_a_mcg REAL,
      vitamin_b6_mg REAL,
      vitamin_b12_mcg REAL,
      vitamin_c_mg REAL,
      vitamin_d_mcg REAL,
      vitamin_e_mg REAL,
      vitamin_k_mcg REAL,
      zinc_mg REAL,
      -- Additional macros
      saturated_fat_g REAL,
      monounsaturated_fat_g REAL,
      polyunsaturated_fat_g REAL,
      trans_fat_g REAL,
      sugar_g REAL,
      added_sugar_g REAL,
      sugar_alcohol_g REAL,
      starch_g REAL,
      alcohol_g REAL,
      caffeine_mg REAL,
      water_ml REAL,
      -- Additional vitamins/minerals
      choline_mg REAL,
      biotin_mcg REAL,
      boron_mg REAL,
      cobalt_mcg REAL,
      fluoride_mg REAL,
      nickel_mg REAL,
      silicon_mg REAL,
      vanadium_mcg REAL,
      -- Metadata
      source_name TEXT DEFAULT 'MacroFactor',
      metadata TEXT,
      UNIQUE(user_id, date)
    )
  `);

  db.run("CREATE INDEX IF NOT EXISTS idx_nutrition_user ON nutrition(user_id)");
  db.run("CREATE INDEX IF NOT EXISTS idx_nutrition_date ON nutrition(date)");

  // Body composition
  db.run(`
    CREATE TABLE IF NOT EXISTS body_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      date TEXT NOT NULL,
      weight_kg REAL,
      weight_lb REAL,
      body_fat_percent REAL,
      bmi REAL,
      lean_body_mass_kg REAL,
      -- MacroFactor body metrics (20 measurements)
      chest_cm REAL,
      waist_cm REAL,
      hips_cm REAL,
      neck_cm REAL,
      shoulders_cm REAL,
      left_bicep_cm REAL,
      right_bicep_cm REAL,
      left_forearm_cm REAL,
      right_forearm_cm REAL,
      left_thigh_cm REAL,
      right_thigh_cm REAL,
      left_calf_cm REAL,
      right_calf_cm REAL,
      left_wrist_cm REAL,
      right_wrist_cm REAL,
      left_ankle_cm REAL,
      right_ankle_cm REAL,
      upper_abdomen_cm REAL,
      lower_abdomen_cm REAL,
      glutes_cm REAL,
      -- Metadata
      source_name TEXT NOT NULL,
      UNIQUE(user_id, date, source_name) ON CONFLICT REPLACE
    )
  `);

  db.run("CREATE INDEX IF NOT EXISTS idx_body_user ON body_metrics(user_id)");
  db.run("CREATE INDEX IF NOT EXISTS idx_body_date ON body_metrics(date)");
  db.run("CREATE INDEX IF NOT EXISTS idx_body_source ON body_metrics(source_name)");

  // Workouts (8,191 from Apple Health)
  db.run(`
    CREATE TABLE IF NOT EXISTS workouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      uuid TEXT,
      activity_type TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      duration_minutes REAL,
      total_distance_km REAL,
      total_energy_kcal REAL,
      source_name TEXT,
      source_version TEXT,
      device TEXT,
      has_route BOOLEAN DEFAULT 0,
      metadata TEXT,
      UNIQUE(user_id, uuid)
    )
  `);

  db.run("CREATE INDEX IF NOT EXISTS idx_workouts_user ON workouts(user_id)");
  db.run("CREATE INDEX IF NOT EXISTS idx_workouts_date ON workouts(start_date)");
  db.run("CREATE INDEX IF NOT EXISTS idx_workouts_type ON workouts(activity_type)");
  db.run("CREATE INDEX IF NOT EXISTS idx_workouts_uuid ON workouts(uuid)");

  // Workout routes (470 GPX files - store references)
  db.run(`
    CREATE TABLE IF NOT EXISTS workout_routes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workout_id INTEGER NOT NULL REFERENCES workouts(id),
      file_path TEXT NOT NULL,
      start_date TEXT,
      end_date TEXT
    )
  `);

  db.run("CREATE INDEX IF NOT EXISTS idx_routes_workout ON workout_routes(workout_id)");

  // Sleep sessions
  db.run(`
    CREATE TABLE IF NOT EXISTS sleep_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      duration_hours REAL,
      sleep_type TEXT,
      source_name TEXT,
      metadata TEXT
    )
  `);

  db.run("CREATE INDEX IF NOT EXISTS idx_sleep_user ON sleep_sessions(user_id)");
  db.run("CREATE INDEX IF NOT EXISTS idx_sleep_date ON sleep_sessions(start_date)");
  db.run("CREATE INDEX IF NOT EXISTS idx_sleep_type ON sleep_sessions(sleep_type)");

  // Activity summaries (2,602 daily Apple Watch rings)
  db.run(`
    CREATE TABLE IF NOT EXISTS activity_summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      date TEXT NOT NULL,
      active_energy_burned REAL,
      active_energy_goal REAL,
      move_time_minutes REAL,
      move_time_goal REAL,
      exercise_time_minutes REAL,
      exercise_time_goal REAL,
      stand_hours INTEGER,
      stand_hours_goal INTEGER,
      UNIQUE(user_id, date)
    )
  `);

  db.run("CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_summaries(user_id)");
  db.run("CREATE INDEX IF NOT EXISTS idx_activity_date ON activity_summaries(date)");

  // ECG recordings (32 files - store references)
  db.run(`
    CREATE TABLE IF NOT EXISTS ecg_recordings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      recorded_date TEXT NOT NULL,
      classification TEXT,
      symptoms TEXT,
      average_heart_rate REAL,
      software_version TEXT,
      device TEXT,
      sample_rate_hz REAL,
      file_path TEXT NOT NULL,
      waveform_json TEXT
    )
  `);

  db.run("CREATE INDEX IF NOT EXISTS idx_ecg_user ON ecg_recordings(user_id)");
  db.run("CREATE INDEX IF NOT EXISTS idx_ecg_date ON ecg_recordings(recorded_date)");
  db.run("CREATE INDEX IF NOT EXISTS idx_ecg_classification ON ecg_recordings(classification)");

  // FHIR clinical records (788 files)
  db.run(`
    CREATE TABLE IF NOT EXISTS clinical_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      resource_type TEXT NOT NULL,
      resource_id TEXT,
      recorded_date TEXT,
      display_name TEXT,
      code TEXT,
      code_system TEXT,
      value_text TEXT,
      value_quantity REAL,
      value_unit TEXT,
      file_path TEXT NOT NULL,
      raw_json TEXT,
      metadata TEXT,
      UNIQUE(user_id, resource_id)
    )
  `);

  db.run("CREATE INDEX IF NOT EXISTS idx_clinical_user ON clinical_records(user_id)");
  db.run("CREATE INDEX IF NOT EXISTS idx_clinical_type ON clinical_records(resource_type)");
  db.run("CREATE INDEX IF NOT EXISTS idx_clinical_date ON clinical_records(recorded_date)");
  db.run("CREATE INDEX IF NOT EXISTS idx_clinical_code ON clinical_records(code)");

  // Import tracking
  db.run(`
    CREATE TABLE IF NOT EXISTS import_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      source_type TEXT NOT NULL,
      source_file TEXT NOT NULL,
      imported_at TEXT DEFAULT CURRENT_TIMESTAMP,
      records_imported INTEGER,
      status TEXT,
      error_log TEXT
    )
  `);

  db.run("CREATE INDEX IF NOT EXISTS idx_import_user ON import_history(user_id)");
  db.run("CREATE INDEX IF NOT EXISTS idx_import_source ON import_history(source_type)");
  db.run("CREATE INDEX IF NOT EXISTS idx_import_date ON import_history(imported_at)");

  console.log("✓ Database schema created successfully");

  return db;
}

// Run if executed directly
if (import.meta.main) {
  const db = initializeDatabase();

  // Display table counts
  console.log("\nDatabase initialized at:", DB_PATH);
  console.log("\nTable summary:");

  const tables = [
    "users",
    "user_profile",
    "health_metrics",
    "nutrition",
    "body_metrics",
    "workouts",
    "workout_routes",
    "sleep_sessions",
    "activity_summaries",
    "ecg_recordings",
    "clinical_records",
    "import_history"
  ];

  tables.forEach(table => {
    const result = db.query(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number };
    console.log(`  ${table.padEnd(20)} ${result.count} records`);
  });

  db.close();
}
