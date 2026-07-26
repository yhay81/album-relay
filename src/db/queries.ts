import { and, asc, desc, eq, isNull, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

import type { Bindings } from "../bindings";
import type { AlbumInput } from "../domain/album";
import { albumVisitors, albums, photos, schema, user } from "./schema";

export function createDatabase(env: Bindings) {
  return drizzle(env.DB, { schema });
}

export type Database = ReturnType<typeof createDatabase>;

export async function listAlbumsByOwner(database: Database, ownerUserId: string) {
  return database
    .select()
    .from(albums)
    .where(eq(albums.ownerUserId, ownerUserId))
    .orderBy(desc(albums.createdAt))
    .all();
}

export async function findAlbumBySlug(database: Database, slug: string) {
  return database.select().from(albums).where(eq(albums.slug, slug)).get();
}

export async function findAlbumByOwner(database: Database, ownerUserId: string, albumId: string) {
  return database
    .select()
    .from(albums)
    .where(and(eq(albums.id, albumId), eq(albums.ownerUserId, ownerUserId)))
    .get();
}

export async function saveAlbum(
  database: Database,
  ownerUserId: string,
  input: AlbumInput,
  credentials: { hash: string; salt: string } | null,
  albumId?: string,
) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + input.expiresDays * 24 * 60 * 60 * 1000);

  if (albumId) {
    const existing = await findAlbumByOwner(database, ownerUserId, albumId);
    if (!existing) return null;
    await database
      .update(albums)
      .set({
        active: input.active,
        allowContributions: input.allowContributions,
        allowDownloads: input.allowDownloads,
        eventDate: input.eventDate,
        expectedViewers: input.expectedViewers,
        expiresAt,
        message: input.message,
        ...(credentials
          ? {
              accessVersion: existing.accessVersion + 1,
              passphraseHash: credentials.hash,
              passphraseSalt: credentials.salt,
            }
          : {}),
        slug: input.slug,
        title: input.title,
        updatedAt: now,
      })
      .where(eq(albums.id, albumId));
    return findAlbumByOwner(database, ownerUserId, albumId);
  }

  if (!credentials) throw new Error("Album credentials are required.");
  const album = {
    accessVersion: 1,
    active: input.active,
    allowContributions: input.allowContributions,
    allowDownloads: input.allowDownloads,
    createdAt: now,
    eventDate: input.eventDate,
    expectedViewers: input.expectedViewers,
    expiresAt,
    id: crypto.randomUUID(),
    message: input.message,
    ownerUserId,
    passphraseHash: credentials.hash,
    passphraseSalt: credentials.salt,
    slug: input.slug,
    title: input.title,
    updatedAt: now,
  };
  await database.insert(albums).values(album);
  return album;
}

export async function listPhotos(database: Database, albumId: string) {
  return database
    .select()
    .from(photos)
    .where(eq(photos.albumId, albumId))
    .orderBy(asc(photos.createdAt))
    .all();
}

export async function countPhotos(database: Database, albumId: string) {
  const rows = await database
    .select({ id: photos.id })
    .from(photos)
    .where(eq(photos.albumId, albumId))
    .all();
  return rows.length;
}

export async function findPhoto(database: Database, albumId: string, photoId: string) {
  return database
    .select()
    .from(photos)
    .where(and(eq(photos.id, photoId), eq(photos.albumId, albumId)))
    .get();
}

export async function createPhoto(database: Database, value: typeof photos.$inferInsert) {
  await database.insert(photos).values(value);
}

export async function deletePhoto(database: Database, albumId: string, photoId: string) {
  return database
    .delete(photos)
    .where(and(eq(photos.id, photoId), eq(photos.albumId, albumId)))
    .returning()
    .get();
}

export async function registerVisitor(database: Database, albumId: string, viewerHash: string) {
  await database
    .insert(albumVisitors)
    .values({
      albumId,
      id: crypto.randomUUID(),
      unlockedAt: new Date(),
      viewerHash,
    })
    .onConflictDoNothing({
      target: [albumVisitors.albumId, albumVisitors.viewerHash],
    });
}

export async function markVisitorViewed(database: Database, albumId: string, viewerHash: string) {
  await database
    .update(albumVisitors)
    .set({ firstViewedAt: new Date() })
    .where(
      and(
        eq(albumVisitors.albumId, albumId),
        eq(albumVisitors.viewerHash, viewerHash),
        isNull(albumVisitors.firstViewedAt),
      ),
    );
}

export async function markVisitorDownloaded(
  database: Database,
  albumId: string,
  viewerHash: string,
) {
  await database
    .update(albumVisitors)
    .set({ firstDownloadedAt: new Date() })
    .where(
      and(
        eq(albumVisitors.albumId, albumId),
        eq(albumVisitors.viewerHash, viewerHash),
        isNull(albumVisitors.firstDownloadedAt),
      ),
    );
}

export async function getAlbumMetrics(database: Database, albumId: string) {
  const visitors = await database
    .select()
    .from(albumVisitors)
    .where(eq(albumVisitors.albumId, albumId))
    .all();
  return {
    downloaded: visitors.filter((visitor) => visitor.firstDownloadedAt).length,
    unlocked: visitors.length,
    viewed: visitors.filter((visitor) => visitor.firstViewedAt).length,
  };
}

export async function listExpiredAlbums(database: Database, now = new Date()) {
  return database.select().from(albums).where(lt(albums.expiresAt, now)).limit(25).all();
}

export async function deleteAlbumRows(database: Database, albumId: string) {
  await database.delete(albums).where(eq(albums.id, albumId));
}

export async function deleteOwnerAccount(database: Database, ownerUserId: string) {
  await database.delete(user).where(eq(user.id, ownerUserId));
}
