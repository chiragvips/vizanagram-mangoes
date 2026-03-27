import { Router } from "express";
import { healthRouter } from "./health.js";
import { transactionsRouter } from "./transactions.js";
import { ledgerRouter } from "./ledger.js";

export const router = Router();

router.use(healthRouter);
router.use(transactionsRouter);
router.use(ledgerRouter);
