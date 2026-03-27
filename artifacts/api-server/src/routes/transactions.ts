import { Router } from "express";
import { db, transactions, insertTransactionSchema } from "@workspace/db";
import { eq } from "drizzle-orm";

export const transactionsRouter = Router();

transactionsRouter.get("/transactions", async (_req, res) => {
  try {
    const rows = await db.select().from(transactions).orderBy(transactions.date, transactions.id);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

transactionsRouter.post("/transactions", async (req, res) => {
  try {
    const parsed = insertTransactionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const [row] = await db.insert(transactions).values(parsed.data).returning();
    res.status(201).json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create transaction" });
  }
});

transactionsRouter.put("/transactions/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const parsed = insertTransactionSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const [row] = await db
      .update(transactions)
      .set(parsed.data)
      .where(eq(transactions.id, id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Transaction not found" });
      return;
    }
    res.json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update transaction" });
  }
});

transactionsRouter.delete("/transactions/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    await db.delete(transactions).where(eq(transactions.id, id));
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete transaction" });
  }
});
