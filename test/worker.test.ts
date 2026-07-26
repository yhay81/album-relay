import { describe, expect, it } from "vitest";

import { app } from "../src/worker";

const bindings = {
  ASSETS: {
    fetch: () => Promise.resolve(new Response("not used")),
  },
};

describe("worker", () => {
  it("renders the Japanese home page with security headers", async () => {
    const response = await app.request("/", undefined, bindings);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(response.headers.get("content-security-policy")).toContain(
      "frame-src https://challenges.cloudflare.com",
    );
    expect(html).toContain('<html lang="ja">');
    expect(html).toContain("QRを渡す。合い言葉を入れる。写真が届く。");
    expect(html).toContain("実案件の完了率で判断します。");
  });

  it("renders first-party authentication without inline script", async () => {
    const response = await app.request("/signup", undefined, bindings);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('data-auth-form="signup"');
    expect(html).toContain('src="/app.js"');
    expect(html).not.toContain("<script>");
  });

  it("exposes a machine-readable health endpoint", async () => {
    const response = await app.request("/healthz", undefined, bindings);
    const body = await response.json<{ healthy: boolean }>();

    expect(response.status).toBe(200);
    expect(body.healthy).toBe(true);
  });

  it("does not expose exception details", async () => {
    const response = await app.request("/missing", undefined, bindings);
    const body = await response.json<{ error: string; requestId: string }>();

    expect(response.status).toBe(404);
    expect(body.error).toBe("not_found");
    expect(body.requestId).toBeTruthy();
  });
});
