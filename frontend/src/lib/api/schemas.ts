/**
 * Zod schemas for runtime validation of API responses.
 *
 * Why?  TypeScript types are compile-time only. If the backend sends a malformed
 * payload (bug, migration, wrong version), the UI would fail with cryptic
 * `undefined` errors at render time. Zod catches the mismatch at parse time
 * and logs actionable errors to the console / Sentry.
 *
 * Each schema should match the TypeScript interface in @/types/index.ts 1:1.
 */

import { z } from 'zod';

// ── Auth & Users ────────────────────────────────────────────────────────────

export const AuthRoleSchema = z.union([z.literal('admin'), z.literal('user'), z.string()]);

export const AuthUserSchema = z.object({
  id: z.coerce.number(),
  email: z.string().email().or(z.string().trim().min(1)), // allow non-email logins too
  name: z.string(),
  role: AuthRoleSchema,
  avatar: z.string().nullish(),
  quick_links: z.string().nullish(),
  dashboard_layout: z.string().nullish(),
  camera_config: z.string().nullish(),
});
export type AuthUserParsed = z.infer<typeof AuthUserSchema>;

// ── Standard ART Workspace envelope — { result, message, data } ─────────────

export const ResponseModelSchema = z.object({
  result: z.string(),
  message: z.string().optional(),
  data: z.unknown().optional(),
});
export type ResponseModelParsed = z.infer<typeof ResponseModelSchema>;

// Typed envelope with `data` schema
export function makeEnvelopeSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return ResponseModelSchema.extend({
    data: dataSchema.optional(),
  });
}

// Login success envelope — data = { session_id, user }
export const LoginResponseSchema = makeEnvelopeSchema(
  z.object({
    session_id: z.string(),
    user: AuthUserSchema,
  }),
);
export type LoginResponseParsed = z.infer<typeof LoginResponseSchema>;

// Register success envelope
export const RegisterResponseSchema = makeEnvelopeSchema(
  z.object({
    user_id: z.coerce.number(),
    email: z.string(),
  }),
);

// Profile session list envelope
export const UserSessionSchema = z.object({
  id: z.coerce.number(),
  session_id: z.string(),
  device_label: z.string(),
  user_agent: z.string().nullish(),
  ip_address: z.string(),
  is_active: z.boolean(),
  last_activity: z.string().nullish(),
  created_at: z.string().nullish(),
});
export const SessionsResponseSchema = makeEnvelopeSchema(z.array(UserSessionSchema));
export type UserSessionParsed = z.infer<typeof UserSessionSchema>;

// ── Dashboard widgets ───────────────────────────────────────────────────────

export const WidgetConfigSchema = z.object({
  id: z.string(),
  w: z.coerce.number().int().min(1).max(3),
});
export const WidgetConfigListSchema = z.array(WidgetConfigSchema);
export type WidgetConfigParsed = z.infer<typeof WidgetConfigSchema>;

export const DashboardLayoutSchema = z.object({
  widgets: WidgetConfigListSchema,
  visibleWidgetIds: z.array(z.string()).optional(),
});

// Oil price widget data shape (partial — extend as needed)
export const OilPriceRowSchema = z.object({
  name: z.string(),
  price: z.union([z.number(), z.string(), z.null()]),
  change: z.union([z.number(), z.string(), z.null()]).optional(),
});
export const OilPriceResponseSchema = makeEnvelopeSchema(
  z.object({
    effective_date: z.string().optional(),
    prices: z.array(OilPriceRowSchema).or(z.record(z.string(), z.unknown())),
  }),
);

// ── Validation helpers ──────────────────────────────────────────────────────

/**
 * Parse JSON and validate against a Zod schema in one go.
 *
 * - Throws a ZOD error (which you can catch) on mismatch, AND
 * - Logs a developer-friendly table of issues to the console.
 *
 * In production you can send the error to Sentry by listening to `zod-error`
 * on `window` or by calling Sentry.captureException directly.
 */
export async function parseJsonWithSchema<T extends z.ZodTypeAny>(
  res: Response,
  schema: T,
): Promise<z.infer<T>> {
  const raw = await res.json();
  const result = schema.safeParse(raw);

  if (!result.success) {
    const issues = result.error.issues;
    if (typeof window !== 'undefined') {
      console.warn('[ZOD] Schema mismatch for %s %s', res.url, '\nIssues:');
      console.table(issues.map((i) => ({
        path: (i.path || []).join('.'),
        message: i.message,
        code: i.code,
      })));
    }
    // Re-throw as ZodError so callers can catch and handle gracefully
    throw result.error;
  }

  return result.data;
}
