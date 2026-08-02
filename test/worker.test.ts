import { describe, expect, it } from "vitest";

import { app } from "../src/worker";

const bindings = {
  ASSETS: {
    fetch: () => Promise.resolve(new Response("not used")),
  },
  PUBLIC_TURNSTILE_SITE_KEY: "test-turnstile-site-key",
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
    expect(html).toContain('lang="ja"');
    expect(html).toContain('itemscope=""');
    expect(html).toContain('itemtype="https://schema.org/WebApplication"');
    expect(html).toContain("写真を、そのままみんなへ。");
    expect(html).toContain("原本をまとめて保存");
    expect(html).toContain('content="summary_large_image" name="twitter:card"');
    expect(html).toContain('content="https://album-relay.yhay81.com/og.jpg" property="og:image"');
    expect(html).not.toContain("PUBLIC EXPERIMENT");
    expect(html).not.toContain("公開パイロット");
  });

  it("renders first-party authentication without inline script", async () => {
    const response = await app.request("/signup", undefined, bindings);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('data-auth-form="signup"');
    expect(html).toContain('src="/app.js"');
    expect(html).toContain('class="cf-turnstile"');
    expect(html).toContain('data-sitekey="test-turnstile-site-key"');
    expect(html).toContain("招待コード（任意）");
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
