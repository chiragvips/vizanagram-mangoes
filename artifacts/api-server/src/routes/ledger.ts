import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export const ledgerRouter = Router();

ledgerRouter.get("/ledger/entries", async (_req, res) => {
  try {
    const entries = await db.execute(sql`
      SELECT e.id, e.date::text, e.description, e.grower_name, e.payment_status, e.created_at,
             json_agg(json_build_object(
               'id', r.id,
               'entry_id', r.entry_id,
               'mark', r.mark,
               'submark1', r.submark1,
               'qty1', r.qty1,
               'rate1', r.rate1,
               'submark2', r.submark2,
               'qty2', r.qty2,
               'rate2', r.rate2,
               'submark3', r.submark3,
               'qty3', r.qty3,
               'rate3', r.rate3,
               'total_qty', r.total_qty,
               'truck_no', r.truck_no,
               'payment_status', r.payment_status,
               'override_station', r.override_station,
               'override_commission', r.override_commission,
               'override_truck', r.override_truck,
               'override_pt', r.override_pt,
               'override_custom', r.override_custom
             ) ORDER BY r.id) as rows
      FROM ledger_entries e
      LEFT JOIN ledger_rows r ON r.entry_id = e.id
      GROUP BY e.id, e.date, e.description, e.grower_name, e.payment_status, e.created_at
      ORDER BY e.date DESC, e.id DESC
    `);
    res.json(entries.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch entries" });
  }
});

ledgerRouter.post("/ledger/entries", async (req, res) => {
  const { date, description = "", grower_name = "", payment_status = "unpaid", rows = [] } = req.body;
  if (!date) { res.status(400).json({ error: "date required" }); return; }
  try {
    const [entry] = (await db.execute(sql`
      INSERT INTO ledger_entries (date, description, grower_name, payment_status) VALUES (${date}, ${description}, ${grower_name}, ${payment_status}) RETURNING *
    `)).rows as any[];
    for (const r of rows) {
      const totalQty = (Number(r.qty1)||0) + (Number(r.qty2)||0) + (Number(r.qty3)||0);
      await db.execute(sql`
        INSERT INTO ledger_rows (entry_id, mark, submark1, qty1, rate1, submark2, qty2, rate2, submark3, qty3, rate3, total_qty, truck_no, payment_status,
          override_station, override_commission, override_truck, override_pt, override_custom)
        VALUES (${entry.id}, ${r.mark||''}, ${r.submark1||''}, ${r.qty1||0}, ${r.rate1||0}, ${r.submark2||''}, ${r.qty2||0}, ${r.rate2||0}, ${r.submark3||''}, ${r.qty3||0}, ${r.rate3||0}, ${totalQty}, ${r.truck_no||null}, ${r.payment_status||'unpaid'},
          ${r.override_station??null}, ${r.override_commission??null}, ${r.override_truck??null}, ${r.override_pt??null}, ${JSON.stringify(r.override_custom ?? {})})
      `);
    }
    const result = (await db.execute(sql`
      SELECT e.id, e.date::text, e.description, e.grower_name, e.payment_status, e.created_at,
             json_agg(json_build_object(
               'id', r.id,
               'entry_id', r.entry_id,
               'mark', r.mark,
               'submark1', r.submark1,
               'qty1', r.qty1,
               'rate1', r.rate1,
               'submark2', r.submark2,
               'qty2', r.qty2,
               'rate2', r.rate2,
               'submark3', r.submark3,
               'qty3', r.qty3,
               'rate3', r.rate3,
               'total_qty', r.total_qty,
               'truck_no', r.truck_no,
               'payment_status', r.payment_status,
               'override_station', r.override_station,
               'override_commission', r.override_commission,
               'override_truck', r.override_truck,
               'override_pt', r.override_pt,
               'override_custom', r.override_custom
             ) ORDER BY r.id) as rows
      FROM ledger_entries e
      LEFT JOIN ledger_rows r ON r.entry_id = e.id
      WHERE e.id = ${entry.id}
      GROUP BY e.id, e.date, e.description, e.grower_name, e.payment_status, e.created_at
    `)).rows[0];
    res.status(201).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create entry" });
  }
});

ledgerRouter.put("/ledger/entries/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { date, description, grower_name, payment_status, rows } = req.body;
  try {
    if (date !== undefined || description !== undefined || grower_name !== undefined || payment_status !== undefined) {
      if (date !== undefined) await db.execute(sql`UPDATE ledger_entries SET date = ${date} WHERE id = ${id}`);
      if (description !== undefined) await db.execute(sql`UPDATE ledger_entries SET description = ${description} WHERE id = ${id}`);
      if (grower_name !== undefined) await db.execute(sql`UPDATE ledger_entries SET grower_name = ${grower_name} WHERE id = ${id}`);
      if (payment_status !== undefined) await db.execute(sql`UPDATE ledger_entries SET payment_status = ${payment_status} WHERE id = ${id}`);
    }
    if (rows) {
      await db.execute(sql`DELETE FROM ledger_rows WHERE entry_id = ${id}`);
      for (const r of rows) {
        const totalQty = (Number(r.qty1)||0) + (Number(r.qty2)||0) + (Number(r.qty3)||0);
        await db.execute(sql`
          INSERT INTO ledger_rows (entry_id, mark, submark1, qty1, rate1, submark2, qty2, rate2, submark3, qty3, rate3, total_qty, truck_no, payment_status,
            override_station, override_commission, override_truck, override_pt, override_custom)
          VALUES (${id}, ${r.mark||''}, ${r.submark1||''}, ${r.qty1||0}, ${r.rate1||0}, ${r.submark2||''}, ${r.qty2||0}, ${r.rate2||0}, ${r.submark3||''}, ${r.qty3||0}, ${r.rate3||0}, ${totalQty}, ${r.truck_no||null}, ${r.payment_status||'unpaid'},
            ${r.override_station??null}, ${r.override_commission??null}, ${r.override_truck??null}, ${r.override_pt??null}, ${JSON.stringify(r.override_custom ?? {})})
        `);
      }
    }
    const result = (await db.execute(sql`
      SELECT e.id, e.date::text, e.description, e.grower_name, e.payment_status, e.created_at,
             json_agg(json_build_object(
               'id', r.id,
               'entry_id', r.entry_id,
               'mark', r.mark,
               'submark1', r.submark1,
               'qty1', r.qty1,
               'rate1', r.rate1,
               'submark2', r.submark2,
               'qty2', r.qty2,
               'rate2', r.rate2,
               'submark3', r.submark3,
               'qty3', r.qty3,
               'rate3', r.rate3,
               'total_qty', r.total_qty,
               'truck_no', r.truck_no,
               'payment_status', r.payment_status,
               'override_station', r.override_station,
               'override_commission', r.override_commission,
               'override_truck', r.override_truck,
               'override_pt', r.override_pt,
               'override_custom', r.override_custom
             ) ORDER BY r.id) as rows
      FROM ledger_entries e
      LEFT JOIN ledger_rows r ON r.entry_id = e.id
      WHERE e.id = ${id}
      GROUP BY e.id, e.date, e.description, e.grower_name, e.payment_status, e.created_at
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

// New endpoint: update payment status for a specific row
ledgerRouter.put("/ledger/rows/:rowId/payment", async (req, res) => {
  const rowId = Number(req.params.rowId);
  const { payment_status } = req.body;
  if (!payment_status || (payment_status !== "paid" && payment_status !== "unpaid")) {
    res.status(400).json({ error: "payment_status must be 'paid' or 'unpaid'" });
    return;
  }
  try {
    await db.execute(sql`UPDATE ledger_rows SET payment_status = ${payment_status} WHERE id = ${rowId}`);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update payment status" });
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
