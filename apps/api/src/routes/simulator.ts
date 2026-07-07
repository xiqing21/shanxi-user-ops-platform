import type { FastifyInstance } from "fastify";
import { generateSnapshot } from "@shanxi/simulator";

export async function simulatorRoutes(app: FastifyInstance) {
  app.post("/simulator/snapshot", async (request) => {
    const body = request.body as Partial<{ seed: number; userCount: number; readingMinutes: number }>;
    return generateSnapshot({
      seed: body.seed ?? 20260707,
      userCount: body.userCount ?? 200,
      readingMinutes: body.readingMinutes ?? 12
    });
  });
}
