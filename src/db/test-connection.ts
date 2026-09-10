import "dotenv/config";
import { query, closeDatabase } from "./database";

async function main() {
  const result = await query<{ now: Date }>("SELECT NOW() AS now");

  console.log("[Database] Connection successful:", result.rows[0].now);
}

main()
  .catch((error) => {
    console.error("[Database] Connection failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase();
  });
