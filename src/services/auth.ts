import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { betterAuth } from "better-auth/minimal";
import { drizzle } from "drizzle-orm/d1";

import type { Bindings } from "../bindings";
import { authSchema } from "../db/schema";

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
        const inviteCode = context.headers?.get("x-pilot-invite") ?? "";
        if (!env.PILOT_INVITE_CODE || inviteCode !== env.PILOT_INVITE_CODE) {
          throw new APIError("FORBIDDEN", {
            message: "現在は招待制です。招待コードを確認してください。",
          });
        }
      }),
    },
    secret: env.BETTER_AUTH_SECRET,
    session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
    trustedOrigins: [origin],
  });
}
