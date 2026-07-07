import type { FastifyInstance } from "fastify";
import { planAnalysisTaskWithDeepSeek } from "../services/deepseek";

export async function agentRoutes(app: FastifyInstance) {
  app.post("/agent/plan", async (request) => {
    const body = request.body as Partial<{ query: string }>;
    return planAnalysisTaskWithDeepSeek(body.query ?? "");
  });
}
