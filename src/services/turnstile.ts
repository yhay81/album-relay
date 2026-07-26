import type { Bindings } from "../bindings";

export async function verifyTurnstile(
  env: Bindings,
  token: string,
  idempotencyKey: string,
): Promise<boolean> {
  if (env.ENVIRONMENT !== "production") return true;
  if (!env.TURNSTILE_SECRET_KEY || !token) return false;

  const body = new FormData();
  body.set("secret", env.TURNSTILE_SECRET_KEY);
  body.set("response", token);
  body.set("idempotency_key", idempotencyKey);
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    body,
    method: "POST",
  });
  if (!response.ok) return false;
  const result = await response.json<{ success?: boolean }>();
  return result.success === true;
}
