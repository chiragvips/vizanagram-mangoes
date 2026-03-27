import { Router } from "express";
import { healthRouter } from "./health.js";
import { transactionsRouter } from "./transactions.js";

export const router = Router();

router.use(healthRouter);
router.use(transactionsRouter);
