import type { FastifyInstance } from "fastify";
import { planAnalysisTaskViaAiService } from "../services/ai-client";

export async function agentRoutes(app: FastifyInstance) {
  app.post("/agent/plan", async (request) => {
    const body = request.body as Partial<{ query: string }>;
    return planAnalysisTaskViaAiService(body.query ?? "");
  });
}
