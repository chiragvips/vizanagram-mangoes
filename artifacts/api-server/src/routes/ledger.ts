import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export const ledgerRouter = Router();

ledgerRouter.get("/ledger/entries", async (_req, res) => {
  try {
    const entries = await db.execute(sql`
      SELECT e.id, e.date::text, e.description, e.payment_status, e.created_at,
             json_agg(r ORDER BY r.id) as rows
      FROM ledger_entries e
      LEFT JOIN ledger_rows r ON r.entry_id = e.id
      GROUP BY e.id, e.date, e.description, e.payment_status, e.created_at
      ORDER BY e.date DESC, e.id DESC
    `);
    res.json(entries.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch entries" });
  }
});

ledgerRouter.post("/ledger/entries", async (req, res) => {
  const { date, description = "", payment_status = "unpaid", rows = [] } = req.body;
  if (!date) { res.status(400).json({ error: "date required" }); return; }
  try {
    const [entry] = (await db.execute(sql`
      INSERT INTO ledger_entries (date, description, payment_status) VALUES (${date}, ${description}, ${payment_status}) RETURNING *
    `)).rows as any[];
    for (const r of rows) {
      const totalQty = (Number(r.qty1)||0) + (Number(r.qty2)||0) + (Number(r.qty3)||0);
      await db.execute(sql`
        INSERT INTO ledger_rows (entry_id, mark, qty1, rate1, qty2, rate2, qty3, rate3, total_qty, truck_no,
          override_station, override_commission, override_truck, override_pt)
        VALUES (${entry.id}, ${r.mark||''}, ${r.qty1||0}, ${r.rate1||0}, ${r.qty2||0}, ${r.rate2||0},
          ${r.qty3||0}, ${r.rate3||0}, ${totalQty}, ${r.truck_no||null},
          ${r.override_station??null}, ${r.override_commission??null}, ${r.override_truck??null}, ${r.override_pt??null})
      `);
    }
    const result = (await db.execute(sql`
      SELECT e.id, e.date::text, e.description, e.payment_status, e.created_at,
             json_agg(r ORDER BY r.id) as rows
      FROM ledger_entries e
      LEFT JOIN ledger_rows r ON r.entry_id = e.id
      WHERE e.id = ${entry.id}
      GROUP BY e.id, e.date, e.description, e.payment_status, e.created_at
    `)).rows[0];
    res.status(201).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create entry" });
  }
});

ledgerRouter.put("/ledger/entries/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { date, description, payment_status, rows } = req.body;
  try {
    if (date !== undefined || description !== undefined || payment_status !== undefined) {
      if (date !== undefined) await db.execute(sql`UPDATE ledger_entries SET date = ${date} WHERE id = ${id}`);
      if (description !== undefined) await db.execute(sql`UPDATE ledger_entries SET description = ${description} WHERE id = ${id}`);
      if (payment_status !== undefined) await db.execute(sql`UPDATE ledger_entries SET payment_status = ${payment_status} WHERE id = ${id}`);
    }
    if (rows) {
      await db.execute(sql`DELETE FROM ledger_rows WHERE entry_id = ${id}`);
      for (const r of rows) {
        const totalQty = (Number(r.qty1)||0) + (Number(r.qty2)||0) + (Number(r.qty3)||0);
        await db.execute(sql`
          INSERT INTO ledger_rows (entry_id, mark, qty1, rate1, qty2, rate2, qty3, rate3, total_qty, truck_no,
            override_station, override_commission, override_truck, override_pt)
          VALUES (${id}, ${r.mark||''}, ${r.qty1||0}, ${r.rate1||0}, ${r.qty2||0}, ${r.rate2||0},
            ${r.qty3||0}, ${r.rate3||0}, ${totalQty}, ${r.truck_no||null},
            ${r.override_station??null}, ${r.override_commission??null}, ${r.override_truck??null}, ${r.override_pt??null})
        `);
      }
    }
    const result = (await db.execute(sql`
      SELECT e.id, e.date::text, e.description, e.payment_status, e.created_at,
             json_agg(r ORDER BY r.id) as rows
      FROM ledger_entries e
      LEFT JOIN ledger_rows r ON r.entry_id = e.id
      WHERE e.id = ${id}
      GROUP BY e.id, e.date, e.description, e.payment_status, e.created_at
    `)).rows[0];
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update entry" });
  }
});

ledgerRouter.delete("/ledger/entries/:id", async (req, res) => {
  const id = Number(req.params.id);
  try {
    await db.execute(sql`DELETE FROM ledger_entries WHERE id = ${id}`);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete" });
  }
});

ledgerRouter.post("/ledger/entries/bulk-delete", async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) { res.status(400).json({ error: "ids required" }); return; }
  try {
    for (const id of ids) {
      await db.execute(sql`DELETE FROM ledger_entries WHERE id = ${id}`);
    }
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to bulk delete" });
  }
});

ledgerRouter.get("/ledger/settings", async (_req, res) => {
  try {
    const result = (await db.execute(sql`SELECT * FROM calc_settings WHERE id = 1`)).rows[0];
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

ledgerRouter.put("/ledger/settings", async (req, res) => {
  const { station_rate, commission_pct, truck_fare, pt_rate, custom_fields } = req.body;
  try {
    const result = (await db.execute(sql`
      UPDATE calc_settings SET
        station_rate = ${station_rate ?? 20},
        commission_pct = ${commission_pct ?? 10},
        truck_fare = ${truck_fare ?? 100},
        pt_rate = ${pt_rate ?? 0},
        custom_fields = ${JSON.stringify(custom_fields ?? [])}
      WHERE id = 1 RETURNING *
    `)).rows[0];
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update settings" });
  }
});
