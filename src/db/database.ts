import fs from "fs";
import path from "path";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is required");
}

export const pool = new Pool({
  connectionString: databaseUrl,
});

pool.on("error", (error) => {
  console.error("[Database] Unexpected PostgreSQL pool error:", error);
});

export async function query<T = unknown>(
  text: string,
  params: unknown[] = []
) {
  return pool.query<T>(text, params);
}

export async function initializeDatabase() {
  const schemaPath = path.join(process.cwd(), "src", "db", "schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf8");

  await pool.query(schema);

  console.log("[Database] PostgreSQL schema initialized");
}

export async function closeDatabase() {
  await pool.end();
}