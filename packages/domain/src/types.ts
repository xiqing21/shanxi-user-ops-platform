export type UserType =
  | "residential"
  | "general_commercial"
  | "large_industrial"
  | "high_energy"
  | "agriculture"
  | "charging_station"
  | "distributed_pv";

export type RiskLevel = "normal" | "watch" | "warning" | "critical";
export type LoadBand = "light" | "normal" | "heavy" | "overload";

export interface UserProfile {
  userId: string;
  userName: string;
  city: string;
  county: string;
  industry: string;
  userType: UserType;
  contractCapacityKva: number;
  transformerId: string;
  lineId: string;
  tags: string[];
}

export interface TelemetryReading {
  readingId: string;
  userId: string;
  meterId: string;
  timestamp: string;
  activePowerKw: number;
  voltageA: number;
  voltageB: number;
  voltageC: number;
  currentA: number;
  currentB: number;
  currentC: number;
  powerFactor: number;
}

export interface RiskEvent {
  eventId: string;
  userId: string;
  riskType: "load_spike" | "overload" | "low_power_factor" | "unbalance" | "voltage_anomaly";
  level: RiskLevel;
  message: string;
  timestamp: string;
}

export interface OperationsSnapshot {
  generatedAt: string;
  users: UserProfile[];
  readings: TelemetryReading[];
  risks: RiskEvent[];
}
