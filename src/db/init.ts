import "dotenv/config";
import { initializeDatabase, closeDatabase } from "./database";

async function main() {
  await initializeDatabase();
}

main()
  .catch((error) => {
    console.error("[Database] Initialization failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase();
  });
