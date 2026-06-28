import "server-only";
import { z } from "zod";

/**
 * Server-only env validation. Parsing runs at module load, so any server
 * file that imports this gets the guarantee that required vars exist.
 *
 * Client components must NOT import from here — use `@/lib/env` for the
 * NEXT_PUBLIC_* subset instead.
 */
// Treat an empty string the same as "unset" — `FOO=` in a .env file yields ""
// which would otherwise trip .min(1) even where the value is meant to be absent.
const optionalSecret = z.preprocess(
  (v) => (v === "" ? undefined : v),
  z.string().min(1).optional(),
);

const serverSchema = z
  .object({
    // Database
    DATABASE_URL: z.string().url(),

    // Supabase
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

    // AI
    DEEPSEEK_API_KEY: optionalSecret,
    QWEN_API_KEY: optionalSecret,

    // Stripe
    STRIPE_SECRET_KEY: optionalSecret,
    STRIPE_WEBHOOK_SECRET: optionalSecret,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: optionalSecret,

    // Site
    NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),

    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
  })
  .superRefine((val, ctx) => {
    // Only enforce on a real Vercel *production* deploy — not on local
    // `next build` (which also sets NODE_ENV=production) or preview deploys.
    // A missing payment secret should fail the deploy fast rather than 500 the
    // first time someone hits checkout. AI keys stay optional (degrade).
    if (process.env.VERCEL_ENV !== "production") return;
    const required = [
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
    ] as const;
    for (const key of required) {
      if (!val[key]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} is required in production`,
        });
      }
    }
  });

export const env = serverSchema.parse(process.env);
export type Env = z.infer<typeof serverSchema>;
