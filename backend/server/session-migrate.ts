import { db } from "./db";
import { sql } from "drizzle-orm";

export async function ensureSessionsTable() {
  try {
    console.log("Checking sessions table...");
    
    // Create sessions table if it doesn't exist
    // This matches the schema expected by connect-pg-simple
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS sessions (
        sid varchar NOT NULL COLLATE "default",
        sess json NOT NULL,
        expire timestamp(6) NOT NULL,
        CONSTRAINT sessions_pkey PRIMARY KEY (sid)
      );
    `);
    
    // Create index on expire column for efficient cleanup
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON sessions (expire);
    `);
    
    console.log("Sessions table ready");
  } catch (error) {
    console.error("Failed to create sessions table:", error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  ensureSessionsTable()
    .then(() => {
      console.log("Session migration complete");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Session migration failed:", error);
      process.exit(1);
    });
}