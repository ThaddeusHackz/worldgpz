import { z } from "zod";

const trimmed = (min, max) => z.string().trim().min(min).max(max);

const identifier = z
  .string()
  .trim()
  .min(1, "Operator identifier is required")
  .max(254);

export const loginSchema = z
  .object({
    // Either an email or the plain operator username (e.g. "admin").
    email: identifier.optional(),
    username: identifier.optional(),
    password: z.string().min(8).max(200),
  })
  .strict()
  .refine((value) => Boolean(value.email || value.username), {
    message: "Operator identifier is required",
    path: ["username"],
  });

export const settingsSchema = z
  .object({
    keys: z.record(z.string().min(1).max(64), z.string().max(400)),
  })
  .strict()
  .refine((value) => Object.keys(value.keys).length > 0, {
    message: "At least one key is required",
  });

export const eventSchema = z
  .object({
    title: trimmed(5, 180),
    summary: trimmed(10, 1000),
    category: z.enum([
      "conflict",
      "climate",
      "cyber",
      "economy",
      "humanitarian",
      "infrastructure",
      "diplomacy",
      "health",
      "seismic",
    ]),
    severity: z.enum(["critical", "high", "medium", "low"]),
    status: z.enum(["verified", "monitoring", "watch", "resolved"]),
    region: trimmed(2, 80),
    country: trimmed(2, 80),
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180),
    sourceName: trimmed(2, 120),
    sourceUrl: z.union([z.url().max(500), z.literal("")]).default(""),
    publishedAt: z.iso.datetime({ offset: true }).optional(),
  })
  .strict();

export const partialEventSchema = eventSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export function parse(schema, payload) {
  const result = schema.safeParse(payload);
  if (result.success) return { data: result.data, error: null };
  return {
    data: null,
    error: result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  };
}
