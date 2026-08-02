import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { betterAuth } from "better-auth/minimal";
import { drizzle } from "drizzle-orm/d1";

import type { Bindings } from "../bindings";
import { authSchema } from "../db/schema";
import { verifyTurnstile } from "./turnstile";

export function createAuth(env: Bindings, origin: string) {
  const database = drizzle(env.DB, { schema: authSchema });
  return betterAuth({
    advanced: { ipAddress: { disableIpTracking: true } },
    baseURL: origin,
    database: drizzleAdapter(database, {
      provider: "sqlite",
      schema: authSchema,
      usePlural: false,
    }),
    emailAndPassword: {
      autoSignIn: false,
      enabled: true,
      minPasswordLength: 12,
    },
    hooks: {
      before: createAuthMiddleware(async (context) => {
        if (context.path !== "/sign-up/email") return;

        const turnstileToken = context.headers?.get("x-turnstile-token") ?? "";
        const idempotencyKey =
          context.headers?.get("x-signup-idempotency-key") ?? crypto.randomUUID();
        if (!(await verifyTurnstile(env, turnstileToken, idempotencyKey))) {
          throw new APIError("FORBIDDEN", {
            message: "安全確認を完了してください。",
          });
        }
      }),
    },
    secret: env.BETTER_AUTH_SECRET,
    session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
    trustedOrigins: [origin],
  });
}
