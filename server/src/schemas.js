import { z } from "zod";

const trimmed = (min, max) => z.string().trim().min(min).max(max);

export const loginSchema = z
  .object({
    email: z
      .email()
      .max(254)
      .transform((value) => value.toLowerCase()),
    password: z.string().min(8).max(200),
  })
  .strict();

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
