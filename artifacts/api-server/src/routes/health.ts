import { Router } from "express";
import { healthCheckResponseSchema } from "@workspace/api-zod";

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  const response = healthCheckResponseSchema.parse({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
  res.json(response);
});
