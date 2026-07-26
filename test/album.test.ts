import { describe, expect, it } from "vitest";

import {
  detectImageMime,
  InputError,
  parseAlbumInput,
  sanitizeFilename,
} from "../src/domain/album";
import {
  createAlbumAccessToken,
  hashPassphrase,
  verifyAlbumAccessToken,
  verifyPassphrase,
} from "../src/security/album-access";

describe("album settings", () => {
  it("normalizes and validates a complete album", () => {
    const formData = new FormData();
    formData.set("title", "夏の撮影会");
    formData.set("slug", " Summer-Photo-2026 ");
    formData.set("message", "ご参加ありがとうございました。");
    formData.set("passphrase", "なつのしゃしん");
    formData.set("eventDate", "2026-07-26");
    formData.set("expectedViewers", "25");
    formData.set("expiresDays", "14");
    formData.set("active", "on");
    formData.set("allowDownloads", "on");

    expect(parseAlbumInput(formData)).toEqual({
      active: true,
      allowContributions: false,
      allowDownloads: true,
      eventDate: "2026-07-26",
      expectedViewers: 25,
      expiresDays: 14,
      message: "ご参加ありがとうございました。",
      passphrase: "なつのしゃしん",
      slug: "summer-photo-2026",
      title: "夏の撮影会",
    });
  });

  it("rejects traversal-like slugs and weak passphrases", () => {
    const formData = new FormData();
    formData.set("title", "Album");
    formData.set("slug", "../private");
    formData.set("passphrase", "123");
    formData.set("expectedViewers", "20");
    formData.set("expiresDays", "14");

    expect(() => parseAlbumInput(formData)).toThrow(InputError);
  });

  it("sanitizes filenames used in headers and archives", () => {
    expect(sanitizeFilename("../summer\r\nphoto.jpg")).toBe(".._summer__photo.jpg");
  });
});

describe("image validation", () => {
  it("detects content by magic bytes rather than declared MIME", async () => {
    const jpeg = new File([new Uint8Array([0xff, 0xd8, 0xff, 0x00])], "photo.bin", {
      type: "application/octet-stream",
    });
    const invalid = new File([new TextEncoder().encode("<svg></svg>")], "photo.jpg", {
      type: "image/jpeg",
    });

    expect(await detectImageMime(jpeg)).toBe("image/jpeg");
    expect(await detectImageMime(invalid)).toBeNull();
  });
});

describe("album access security", () => {
  const secret = "test-album-access-secret-at-least-32-characters";

  it("hashes passphrases with a random salt and verifies normalized input", async () => {
    const credentials = await hashPassphrase("ＡＢＣ１２３");

    expect(credentials.hash).not.toContain("ABC123");
    expect(await verifyPassphrase("ABC123", credentials.salt, credentials.hash)).toBe(true);
    expect(await verifyPassphrase("wrong", credentials.salt, credentials.hash)).toBe(false);
  });

  it("binds a signed access token to one album and rejects tampering", async () => {
    const expiresAt = new Date(Date.now() + 60_000);
    const { token } = await createAlbumAccessToken(secret, "album-a", 2, expiresAt, "viewer-a");

    expect(await verifyAlbumAccessToken(secret, token, "album-a", 2)).toMatchObject({
      accessVersion: 2,
      albumId: "album-a",
      viewerId: "viewer-a",
    });
    expect(await verifyAlbumAccessToken(secret, token, "album-b", 2)).toBeNull();
    expect(await verifyAlbumAccessToken(secret, token, "album-a", 3)).toBeNull();
    expect(await verifyAlbumAccessToken(secret, `${token}x`, "album-a", 2)).toBeNull();
  });
});
