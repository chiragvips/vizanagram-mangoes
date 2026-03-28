import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { app } from "./app.js";
import express from "express";
import path from "path";

const PORT = process.env.PORT ?? 3000;

async function ensureSchema() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ledger_entries (
      id SERIAL PRIMARY KEY,
      date DATE NOT NULL,
      payment_status TEXT DEFAULT 'unpaid',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ledger_rows (
      id SERIAL PRIMARY KEY,
      entry_id INTEGER NOT NULL REFERENCES ledger_entries(id) ON DELETE CASCADE,
      mark TEXT NOT NULL,
      qty1 NUMERIC(10,2) DEFAULT 0,
      rate1 NUMERIC(10,2) DEFAULT 0,
      qty2 NUMERIC(10,2) DEFAULT 0,
      rate2 NUMERIC(10,2) DEFAULT 0,
      qty3 NUMERIC(10,2) DEFAULT 0,
      rate3 NUMERIC(10,2) DEFAULT 0,
      total_qty NUMERIC(10,2) DEFAULT 0,
      truck_no TEXT,
      override_station NUMERIC(12,2),
      override_commission NUMERIC(12,2),
      override_truck NUMERIC(12,2),
      override_pt NUMERIC(12,2)
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS calc_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      station_rate NUMERIC(10,2) DEFAULT 20,
      commission_pct NUMERIC(5,2) DEFAULT 10,
      truck_fare NUMERIC(10,2) DEFAULT 100,
      pt_rate NUMERIC(10,2) DEFAULT 0,
      custom_fields JSONB DEFAULT '[]'
    )
  `);
  await db.execute(sql`
    INSERT INTO calc_settings (id, station_rate, commission_pct, truck_fare, pt_rate, custom_fields)
    VALUES (1, 20, 10, 100, 0, '[]')
    ON CONFLICT (id) DO NOTHING
  `);
}

async function main() {
  try {
    await ensureSchema();
    console.log("Database schema ready");
  } catch (err) {
    console.error("Schema setup error:", err);
  }

  const staticDir = path.join(process.cwd(), "artifacts/shop-app/dist/public");
  app.use(express.static(staticDir));
  app.get("*", (_req: any, res: any) => {
    res.sendFile(path.join(staticDir, "index.html"));
  });

  app.listen(PORT, () => {
    console.log(`API server listening on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
