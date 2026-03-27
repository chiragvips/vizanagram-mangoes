import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { app } from "./app.js";

const PORT = process.env.PORT ?? 3000;

async function ensureSchema() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      date DATE NOT NULL,
      description TEXT NOT NULL,
      party_name TEXT,
      quantity NUMERIC(10, 2),
      rate NUMERIC(10, 2),
      amount NUMERIC(12, 2) NOT NULL,
      transaction_type TEXT DEFAULT 'entry',
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
}

async function main() {
  try {
    await ensureSchema();
    console.log("Database schema ready");
  } catch (err) {
    console.error("Schema setup error:", err);
  }

  app.listen(PORT, () => {
    console.log(`API server listening on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
