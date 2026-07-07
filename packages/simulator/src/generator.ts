import {
  calculateLoadRate,
  calculateUnbalance,
  type OperationsSnapshot,
  type RiskEvent,
  type TelemetryReading,
  type UserProfile,
  type UserType
} from "@shanxi/domain";
import { industries, shanxiCities, userNames } from "./scenarios";

export interface GenerateSnapshotOptions {
  seed: number;
  userCount: number;
  readingMinutes: number;
}

function seeded(seed: number): () => number {
  let value = seed % 2147483647;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function pick<T>(items: readonly T[], random: () => number): T {
  return items[Math.floor(random() * items.length)];
}

function userTypeFor(index: number): UserType {
  const types: UserType[] = ["residential", "general_commercial", "large_industrial", "high_energy", "agriculture", "charging_station", "distributed_pv"];
  return types[index % types.length];
}

export function generateSnapshot(options: GenerateSnapshotOptions): OperationsSnapshot {
  const random = seeded(options.seed);
  const generatedAt = "2026-07-07T12:00:00.000+08:00";
  const users: UserProfile[] = Array.from({ length: options.userCount }, (_, index) => {
    const city = pick(shanxiCities, random);
    const userType = userTypeFor(index);
    const industry = userType === "residential" ? "居民生活" : pick(industries, random);
    const capacity = userType === "large_industrial" || userType === "high_energy" ? 8000 + Math.floor(random() * 30000) : 50 + Math.floor(random() * 1500);
    return {
      userId: `SX-U-${String(index + 1).padStart(6, "0")}`,
      userName: `${city}${pick(userNames, random)}${industry}用户${index + 1}`,
      city,
      county: `${city}示范县${(index % 5) + 1}`,
      industry,
      userType,
      contractCapacityKva: capacity,
      transformerId: `TR-${city}-${index % 30}`,
      lineId: `LN-${city}-${index % 12}`,
      tags: index % 9 === 0 ? ["煤改电"] : userType === "large_industrial" ? ["大工业"] : []
    };
  });

  const readings: TelemetryReading[] = [];
  const risks: RiskEvent[] = [];
  for (const user of users) {
    for (let minute = 0; minute < options.readingMinutes; minute += 1) {
      const spike = user.userType === "large_industrial" && minute === options.readingMinutes - 1 && Number(user.userId.slice(-1)) % 3 === 0;
      const activePowerKw = Number((user.contractCapacityKva * (spike ? 1.15 : 0.35 + random() * 0.45)).toFixed(2));
      const currentA = Number((activePowerKw / 3 + random() * 20).toFixed(2));
      const currentB = Number((activePowerKw / 3 + random() * 20).toFixed(2));
      const currentC = Number((activePowerKw / 3 + (spike ? 120 : random() * 20)).toFixed(2));
      const timestamp = `2026-07-07T12:${String(minute).padStart(2, "0")}:00.000+08:00`;
      readings.push({
        readingId: `${user.userId}-${minute}`,
        userId: user.userId,
        meterId: `M-${user.userId}`,
        timestamp,
        activePowerKw,
        voltageA: 220 + random() * 8,
        voltageB: 220 + random() * 8,
        voltageC: 220 + random() * 8,
        currentA,
        currentB,
        currentC,
        powerFactor: spike ? 0.78 : 0.9 + random() * 0.08
      });
      const loadRate = calculateLoadRate(activePowerKw, user.contractCapacityKva);
      const unbalance = calculateUnbalance({ a: currentA, b: currentB, c: currentC });
      if (spike || loadRate > 100 || unbalance > 25) {
        risks.push({
          eventId: `R-${user.userId}-${minute}`,
          userId: user.userId,
          riskType: spike ? "load_spike" : unbalance > 25 ? "unbalance" : "overload",
          level: loadRate > 100 ? "critical" : "warning",
          message: `${user.userName}出现${spike ? "晚高峰负荷突增" : "运行异常"}`,
          timestamp
        });
      }
    }
  }

  return { generatedAt, users, readings, risks };
}
