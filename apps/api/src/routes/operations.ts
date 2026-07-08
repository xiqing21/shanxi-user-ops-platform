import type { FastifyInstance } from "fastify";
import { calculateLoadRate } from "@shanxi/domain";
import { loadSnapshot } from "../services/fixture-store";

export async function operationsRoutes(app: FastifyInstance) {
  app.get("/operations/summary", async () => {
    const snapshot = await loadSnapshot();
    const latestByUser = new Map(snapshot.readings.map((reading) => [reading.userId, reading]));
    const totalLoadKw = Array.from(latestByUser.values()).reduce((sum, reading) => sum + reading.activePowerKw, 0);
    const largeIndustrialUsers = snapshot.users.filter((user) => user.userType === "large_industrial");
    const criticalRisks = snapshot.risks.filter((risk) => risk.level === "critical");
    return {
      generatedAt: snapshot.generatedAt,
      totalUsers: snapshot.users.length,
      totalLoadKw: Number(totalLoadKw.toFixed(2)),
      largeIndustrialUsers: largeIndustrialUsers.length,
      activeRisks: snapshot.risks.length,
      criticalRisks: criticalRisks.length
    };
  });

  app.get("/operations/risks", async () => {
    const snapshot = await loadSnapshot();
    const users = new Map(snapshot.users.map((user) => [user.userId, user]));
    return snapshot.risks.slice(0, 50).map((risk) => {
      const user = users.get(risk.userId);
      return {
        ...risk,
        userName: user?.userName ?? risk.userId,
        city: user?.city ?? "未知",
        county: user?.county ?? "未知",
        userType: user?.userType ?? "unknown",
        industry: user?.industry ?? "未知"
      };
    });
  });

  app.get("/operations/industrial", async () => {
    const snapshot = await loadSnapshot();
    const latest = new Map(snapshot.readings.map((reading) => [reading.userId, reading]));
    return snapshot.users
      .filter((user) => user.userType === "large_industrial" || user.userType === "high_energy")
      .map((user) => {
        const reading = latest.get(user.userId);
        return {
          ...user,
          activePowerKw: reading?.activePowerKw ?? 0,
          loadRate: reading ? calculateLoadRate(reading.activePowerKw, user.contractCapacityKva, reading.powerFactor) : 0
        };
      })
      .sort((a, b) => b.activePowerKw - a.activePowerKw)
      .slice(0, 30);
  });
}
