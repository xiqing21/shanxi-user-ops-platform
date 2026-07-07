import type { FastifyInstance } from "fastify";
import { planAnalysisTask } from "@shanxi/agent";

export async function agentRoutes(app: FastifyInstance) {
  app.post("/agent/plan", async (request) => {
    const body = request.body as Partial<{ query: string }>;
    return planAnalysisTask(body.query ?? "");
  });
}
