import type { Album } from "../db/schema";

export type AlbumInput = {
  active: boolean;
  allowContributions: boolean;
  allowDownloads: boolean;
  eventDate: string | null;
  expectedViewers: number;
  expiresDays: 7 | 14 | 30;
  message: string;
  passphrase: string;
  slug: string;
  title: string;
};

export class InputError extends Error {}

const slugPattern = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/;

export function parseAlbumInput(formData: FormData, existing?: Album): AlbumInput {
  const title = getTextField(formData, "title").trim();
  const slug = getTextField(formData, "slug").trim().toLowerCase();
  const message = getTextField(formData, "message").trim();
  const passphrase = getTextField(formData, "passphrase");
  const eventDateValue = getTextField(formData, "eventDate");
  const expectedViewers = Number(getTextField(formData, "expectedViewers"));
  const expiresDays = Number(getTextField(formData, "expiresDays"));

  if (title.length < 1 || title.length > 80) {
    throw new InputError("アルバム名は1〜80文字で入力してください。");
  }
  if (!slugPattern.test(slug)) {
    throw new InputError("URL名は英小文字・数字・ハイフンの3〜40文字で入力してください。");
  }
  if (message.length > 400) {
    throw new InputError("案内文は400文字以内で入力してください。");
  }
  if ((!existing || passphrase) && (passphrase.length < 6 || passphrase.length > 100)) {
    throw new InputError("合い言葉は6〜100文字で入力してください。");
  }
  if (!Number.isInteger(expectedViewers) || expectedViewers < 1 || expectedViewers > 500) {
    throw new InputError("招待人数は1〜500人で入力してください。");
  }
  if (expiresDays !== 7 && expiresDays !== 14 && expiresDays !== 30) {
    throw new InputError("公開期間を選んでください。");
  }
  if (eventDateValue && !isValidDate(eventDateValue)) {
    throw new InputError("撮影日を確認してください。");
  }

  return {
    active: getTextField(formData, "active") === "on",
    allowContributions: getTextField(formData, "allowContributions") === "on",
    allowDownloads: getTextField(formData, "allowDownloads") === "on",
    eventDate: eventDateValue || null,
    expectedViewers,
    expiresDays,
    message,
    passphrase,
    slug,
    title,
  };
}

export function getTextField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export function getFileField(formData: FormData, name: string): File | null {
  const value = formData.get(name);
  return value instanceof File ? value : null;
}

export function isSameOrigin(request: Request): boolean {
  const expected = new URL(request.url).origin;
  const origin = request.headers.get("origin");
  if (origin) return origin === expected;
  const referer = request.headers.get("referer");
  return referer ? new URL(referer).origin === expected : false;
}

export function sanitizeFilename(filename: string): string {
  const clean = filename
    .normalize("NFKC")
    .replaceAll(/[\p{Cc}/\\]/gu, "_")
    .trim()
    .slice(0, 180);
  return clean || "photo";
}

export async function detectImageMime(
  file: File,
): Promise<"image/jpeg" | "image/png" | "image/webp" | null> {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "image/png";
  }
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}
