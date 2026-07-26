import { downloadZip } from "client-zip";

import type { Bindings } from "../bindings";
import {
  countPhotos,
  createPhoto,
  type Database,
  deleteAlbumRows,
  deletePhoto,
  listExpiredAlbums,
  listPhotos,
} from "../db/queries";
import type { Album, Photo } from "../db/schema";
import {
  detectImageMime,
  getFileField,
  getTextField,
  InputError,
  sanitizeFilename,
} from "../domain/album";

const MAX_ORIGINAL_BYTES = 20 * 1024 * 1024;
const MAX_THUMBNAIL_BYTES = 3 * 1024 * 1024;
const MAX_PHOTOS_PER_ALBUM = 2000;

export async function storePhoto(
  env: Bindings,
  database: Database,
  album: Album,
  formData: FormData,
  uploadedBy: "owner" | "guest",
) {
  if ((await countPhotos(database, album.id)) >= MAX_PHOTOS_PER_ALBUM) {
    throw new InputError("1アルバムの上限2,000枚に達しました。");
  }

  const original = getFileField(formData, "original");
  const thumbnail = getFileField(formData, "thumbnail");
  if (!original || !thumbnail) throw new InputError("写真を選んでください。");
  if (original.size < 1 || original.size > MAX_ORIGINAL_BYTES) {
    throw new InputError("原本は1枚20MB以内にしてください。");
  }
  if (thumbnail.size < 1 || thumbnail.size > MAX_THUMBNAIL_BYTES) {
    throw new InputError("サムネイルを生成できませんでした。");
  }

  const [mimeType, thumbnailMime] = await Promise.all([
    detectImageMime(original),
    detectImageMime(thumbnail),
  ]);
  if (!mimeType || !thumbnailMime) {
    throw new InputError("JPEG、PNG、WebPの写真だけアップロードできます。");
  }

  const width = Number(getTextField(formData, "width"));
  const height = Number(getTextField(formData, "height"));
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > 100_000 ||
    height > 100_000
  ) {
    throw new InputError("写真サイズを確認できませんでした。");
  }

  const photoId = crypto.randomUUID();
  const filename = sanitizeFilename(original.name);
  const extension = mimeToExtension(mimeType);
  const originalKey = `${album.id}/original/${photoId}.${extension}`;
  const thumbnailKey = `${album.id}/thumbnail/${photoId}.jpg`;

  await Promise.all([
    env.PHOTOS.put(originalKey, original, {
      httpMetadata: { contentType: mimeType },
    }),
    env.PHOTOS.put(thumbnailKey, thumbnail, {
      httpMetadata: { contentType: thumbnailMime },
    }),
  ]);

  try {
    await createPhoto(database, {
      albumId: album.id,
      byteSize: original.size,
      createdAt: new Date(),
      filename,
      height,
      id: photoId,
      mimeType,
      originalKey,
      thumbnailKey,
      uploadedBy,
      width,
    });
  } catch (error) {
    await env.PHOTOS.delete([originalKey, thumbnailKey]);
    throw error;
  }

  return { filename, id: photoId };
}

export async function removePhoto(
  env: Bindings,
  database: Database,
  albumId: string,
  photoId: string,
) {
  const deleted = await deletePhoto(database, albumId, photoId);
  if (!deleted) return false;
  await env.PHOTOS.delete([deleted.originalKey, deleted.thumbnailKey]);
  return true;
}

export async function removeAlbum(env: Bindings, database: Database, albumId: string) {
  await removeAlbumObjects(env.PHOTOS, albumId);
  await deleteAlbumRows(database, albumId);
}

export async function cleanupExpiredAlbums(env: Bindings, database: Database) {
  const expired = await listExpiredAlbums(database);
  for (const album of expired) {
    await removeAlbum(env, database, album.id);
  }
  return expired.length;
}

export async function getAlbumZip(env: Bindings, database: Database, album: Album) {
  const albumPhotos = await listPhotos(database, album.id);
  const metadata = albumPhotos.map((photo, index) => ({
    name: archiveFilename(photo, index),
    size: photo.byteSize,
  }));

  async function* files() {
    for (const [index, photo] of albumPhotos.entries()) {
      const object = await env.PHOTOS.get(photo.originalKey);
      if (!object) throw new Error("Photo object is missing.");
      yield {
        input: object.body,
        lastModified: photo.createdAt,
        name: archiveFilename(photo, index),
        size: photo.byteSize,
      };
    }
  }

  const response = downloadZip(files(), { buffersAreUTF8: true, metadata });
  const headers = new Headers(response.headers);
  headers.set(
    "Content-Disposition",
    `attachment; filename*=UTF-8''${encodeURIComponent(`${album.slug}-photos.zip`)}`,
  );
  headers.set("Cache-Control", "private, no-store");
  return new Response(response.body, { headers, status: response.status });
}

export async function getStoredObject(bucket: R2Bucket, key: string) {
  return bucket.get(key);
}

async function removeAlbumObjects(bucket: R2Bucket, albumId: string) {
  let cursor: string | undefined;
  do {
    const result = await bucket.list(
      cursor ? { cursor, prefix: `${albumId}/` } : { prefix: `${albumId}/` },
    );
    if (result.objects.length > 0) {
      await bucket.delete(result.objects.map((object) => object.key));
    }
    cursor = result.truncated ? result.cursor : undefined;
  } while (cursor);
}

function archiveFilename(photo: Photo, index: number) {
  return `${String(index + 1).padStart(4, "0")}-${sanitizeFilename(photo.filename)}`;
}

function mimeToExtension(mime: Photo["mimeType"]) {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}
