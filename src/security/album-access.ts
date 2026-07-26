import { hashPassword, verifyPassword } from "better-auth/crypto";

const encoder = new TextEncoder();
const PASSPHRASE_SCHEME = "scrypt-v1";

export type AlbumAccess = {
  accessVersion: number;
  albumId: string;
  expiresAt: number;
  viewerId: string;
};

export async function hashPassphrase(passphrase: string) {
  const hash = await hashPassword(passphrase.normalize("NFKC"));
  return { hash, salt: PASSPHRASE_SCHEME };
}

export async function verifyPassphrase(passphrase: string, salt: string, expectedHash: string) {
  if (salt !== PASSPHRASE_SCHEME) return false;
  return verifyPassword({
    hash: expectedHash,
    password: passphrase.normalize("NFKC"),
  });
}

export async function createAlbumAccessToken(
  secret: string,
  albumId: string,
  accessVersion: number,
  expiresAt: Date,
  viewerId = toBase64Url(crypto.getRandomValues(new Uint8Array(18))),
) {
  const payload: AlbumAccess = {
    accessVersion,
    albumId,
    expiresAt: Math.floor(expiresAt.getTime() / 1000),
    viewerId,
  };
  const encoded = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await sign(secret, encoded);
  return { token: `${encoded}.${signature}`, viewerId };
}

export async function verifyAlbumAccessToken(
  secret: string,
  token: string | undefined,
  expectedAlbumId: string,
  expectedAccessVersion: number,
): Promise<AlbumAccess | null> {
  if (!token || !secret) return null;
  const [encoded, signature, extra] = token.split(".");
  if (!encoded || !signature || extra) return null;
  const expectedSignature = await sign(secret, encoded);
  if (!constantTimeEqual(signature, expectedSignature)) return null;

  try {
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(encoded))) as AlbumAccess;
    if (
      payload.albumId !== expectedAlbumId ||
      payload.accessVersion !== expectedAccessVersion ||
      !payload.viewerId ||
      payload.expiresAt <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export async function hashViewerId(secret: string, viewerId: string) {
  return (await sign(secret, viewerId)).slice(0, 32);
}

async function sign(secret: string, input: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(input));
  return toBase64Url(new Uint8Array(signature));
}

function constantTimeEqual(left: string, right: string) {
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  let difference = leftBytes.length ^ rightBytes.length;
  const length = Math.max(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  return difference === 0;
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(value: string) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + padding);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
