import type { FastifyInstance } from "fastify";
import { generateSnapshot } from "@shanxi/simulator";
import { saveSnapshot } from "../services/fixture-store";

export async function simulatorRoutes(app: FastifyInstance) {
  app.post("/simulator/snapshot", async (request) => {
    const body = request.body as Partial<{ seed: number; userCount: number; readingMinutes: number }>;
    const snapshot = generateSnapshot({
      seed: body.seed ?? 20260707,
      userCount: body.userCount ?? 200,
      readingMinutes: body.readingMinutes ?? 12
    });
    await saveSnapshot(snapshot);
    return { ...snapshot, persisted: true };
  });
}
