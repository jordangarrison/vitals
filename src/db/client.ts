import { Database } from "bun:sqlite";
import { resolve } from "path";

const DB_PATH =
  process.env.NODE_ENV === "test"
    ? resolve(import.meta.dir, "../../data/test-vitals.db")
    : resolve(import.meta.dir, "../../data/vitals.db");

let dbInstance: Database | null = null;

export function getDatabase(dbPath?: string): Database {
  // If a custom path is provided, return a new connection (for testing)
  if (dbPath) {
    const db = new Database(dbPath);
    db.run("PRAGMA foreign_keys = ON");
    db.run("PRAGMA journal_mode = WAL");
    db.run("PRAGMA synchronous = NORMAL");
    db.run("PRAGMA cache_size = 10000");
    db.run("PRAGMA temp_store = MEMORY");
    return db;
  }

  if (!dbInstance) {
    dbInstance = new Database(DB_PATH);

    // Enable foreign keys and performance optimizations
    dbInstance.run("PRAGMA foreign_keys = ON");
    dbInstance.run("PRAGMA journal_mode = WAL");
    dbInstance.run("PRAGMA synchronous = NORMAL");
    dbInstance.run("PRAGMA cache_size = 10000");
    dbInstance.run("PRAGMA temp_store = MEMORY");
  }

  return dbInstance;
}

export function setDatabase(db: Database): void {
  dbInstance = db;
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

// Graceful shutdown
process.on("beforeExit", () => {
  closeDatabase();
});

process.on("SIGINT", () => {
  closeDatabase();
  process.exit(0);
});

process.on("SIGTERM", () => {
  closeDatabase();
  process.exit(0);
});
