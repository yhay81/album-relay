import { createMiddleware } from "hono/factory";

const csp = [
  "default-src 'self'",
  "base-uri 'none'",
  "connect-src 'self' https://challenges.cloudflare.com",
  "font-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "frame-src https://challenges.cloudflare.com",
  "img-src 'self' data:",
  "object-src 'none'",
  "script-src 'self' https://challenges.cloudflare.com",
  "style-src 'self'",
].join("; ");

export const securityHeaders = createMiddleware(async (c, next) => {
  await next();

  c.header("Content-Security-Policy", csp);
  c.header("Cross-Origin-Opener-Policy", "same-origin");
  c.header("Cross-Origin-Resource-Policy", "same-origin");
  c.header("Permissions-Policy", "camera=(), geolocation=(), microphone=()");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("X-Robots-Tag", "noai, noimageai");
});
