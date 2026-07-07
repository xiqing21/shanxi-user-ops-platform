import type { LoadBand } from "./types";

export function calculateLoadRate(activePowerKw: number, contractCapacityKva: number, powerFactor = 0.9): number {
  if (contractCapacityKva <= 0 || powerFactor <= 0) return 0;
  return Number(((activePowerKw / (contractCapacityKva * powerFactor)) * 100).toFixed(2));
}

export function classifyLoadRate(rate: number): LoadBand {
  if (rate < 20) return "light";
  if (rate <= 80) return "normal";
  if (rate <= 100) return "heavy";
  return "overload";
}

export function calculateUnbalance(currents: { a: number; b: number; c: number }): number {
  const max = Math.max(currents.a, currents.b, currents.c);
  const min = Math.min(currents.a, currents.b, currents.c);
  if (max <= 0) return 0;
  return Number((((max - min) / max) * 100).toFixed(2));
}
