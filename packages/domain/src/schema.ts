import { z } from "zod";

export const userTypeSchema = z.enum([
  "residential",
  "general_commercial",
  "large_industrial",
  "high_energy",
  "agriculture",
  "charging_station",
  "distributed_pv"
]);

export const userProfileSchema = z.object({
  userId: z.string(),
  userName: z.string(),
  city: z.string(),
  county: z.string(),
  industry: z.string(),
  userType: userTypeSchema,
  contractCapacityKva: z.number().positive(),
  transformerId: z.string(),
  lineId: z.string(),
  tags: z.array(z.string())
});
