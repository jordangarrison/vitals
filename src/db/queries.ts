import { getDatabase } from "./client";

export interface User {
  id: number;
  username: string;
  display_name: string;
  created_at: string;
}

export interface UserProfile {
  id: number;
  user_id: number;
  date_of_birth: string;
  biological_sex?: string;
  blood_type?: string;
  fitzpatrick_skin_type?: string;
  cardio_fitness_medications_use?: string;
  created_at: string;
}

/**
 * Get or create a user by username
 */
export function getOrCreateUser(username: string, displayName?: string): User {
  const db = getDatabase();

  // Try to find existing user
  const existingUser = db
    .query<User, string>("SELECT * FROM users WHERE username = ?")
    .get(username);

  if (existingUser) {
    return existingUser;
  }

  // Create new user
  const result = db
    .query("INSERT INTO users (username, display_name) VALUES (?, ?)")
    .run(username, displayName || username);

  return {
    id: result.lastInsertRowid as number,
    username,
    display_name: displayName || username,
    created_at: new Date().toISOString(),
  };
}

/**
 * Get all users
 */
export function getAllUsers(): User[] {
  const db = getDatabase();
  return db.query<User, []>("SELECT * FROM users ORDER BY username").all();
}

/**
 * Get user by ID
 */
export function getUserById(userId: number): User | null {
  const db = getDatabase();
  return db.query<User, number>("SELECT * FROM users WHERE id = ?").get(userId);
}

/**
 * Get user profile for a user
 */
export function getUserProfile(userId: number): UserProfile | null {
  const db = getDatabase();
  return db
    .query<UserProfile, number>("SELECT * FROM user_profile WHERE user_id = ?")
    .get(userId);
}

/**
 * Create or update user profile
 */
export function upsertUserProfile(profile: Omit<UserProfile, "id" | "created_at">): void {
  const db = getDatabase();

  db.query(`
    INSERT INTO user_profile (
      user_id, date_of_birth, biological_sex, blood_type,
      fitzpatrick_skin_type, cardio_fitness_medications_use
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      date_of_birth = excluded.date_of_birth,
      biological_sex = excluded.biological_sex,
      blood_type = excluded.blood_type,
      fitzpatrick_skin_type = excluded.fitzpatrick_skin_type,
      cardio_fitness_medications_use = excluded.cardio_fitness_medications_use
  `).run(
    profile.user_id,
    profile.date_of_birth,
    profile.biological_sex || null,
    profile.blood_type || null,
    profile.fitzpatrick_skin_type || null,
    profile.cardio_fitness_medications_use || null
  );
}

/**
 * Get distinct metric types for a user
 */
export function getMetricTypes(userId: number): string[] {
  const db = getDatabase();
  const results = db
    .query<{ metric_type: string }, number>(
      "SELECT DISTINCT metric_type FROM health_metrics WHERE user_id = ? ORDER BY metric_type"
    )
    .all(userId);

  return results.map((r) => r.metric_type);
}

/**
 * Get date range for a specific metric type
 */
export function getMetricDateRange(
  userId: number,
  metricType: string
): { min_date: string; max_date: string; count: number } | null {
  const db = getDatabase();
  return db
    .query<{ min_date: string; max_date: string; count: number }, [number, string]>(
      `SELECT
        MIN(start_date) as min_date,
        MAX(start_date) as max_date,
        COUNT(*) as count
      FROM health_metrics
      WHERE user_id = ? AND metric_type = ?`
    )
    .get(userId, metricType);
}

/**
 * Record import history
 */
export function recordImport(
  userId: number,
  sourceType: string,
  sourceFile: string,
  recordsImported: number,
  status: "success" | "partial" | "failed",
  errorLog?: string
): void {
  const db = getDatabase();

  db.query(`
    INSERT INTO import_history (
      user_id, source_type, source_file, records_imported, status, error_log
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, sourceType, sourceFile, recordsImported, status, errorLog || null);
}

/**
 * Get import history for a user
 */
export function getImportHistory(userId: number, limit: number = 10) {
  const db = getDatabase();
  return db
    .query<any, [number, number]>(
      `SELECT * FROM import_history
       WHERE user_id = ?
       ORDER BY imported_at DESC
       LIMIT ?`
    )
    .all(userId, limit);
}
