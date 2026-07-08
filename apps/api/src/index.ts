import cors from "@fastify/cors";
import Fastify from "fastify";
import { agentRoutes } from "./routes/agent";
import { healthRoutes } from "./routes/health";
import { operationsRoutes } from "./routes/operations";
import { simulatorRoutes } from "./routes/simulator";
import { textToSqlRoutes } from "./routes/text-to-sql";

export async function buildApp() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });
  await app.register(healthRoutes);
  await app.register(operationsRoutes);
  await app.register(simulatorRoutes);
  await app.register(agentRoutes);
  await app.register(textToSqlRoutes);
  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const app = await buildApp();
  await app.listen({ port: Number(process.env.PORT ?? 4000), host: "0.0.0.0" });
}
