import cors from "@fastify/cors";
import Fastify from "fastify";
import { healthRoutes } from "./routes/health";
import { operationsRoutes } from "./routes/operations";
import { simulatorRoutes } from "./routes/simulator";

export async function buildApp() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });
  await app.register(healthRoutes);
  await app.register(operationsRoutes);
  await app.register(simulatorRoutes);
  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const app = await buildApp();
  await app.listen({ port: Number(process.env.PORT ?? 4000), host: "0.0.0.0" });
}
