import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const user = sqliteTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: integer("email_verified", { mode: "boolean" }).default(false).notNull(),
    image: text("image"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [uniqueIndex("user_email_unique").on(table.email)],
);

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    token: text("token").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("session_token_unique").on(table.token),
    index("session_user_id_idx").on(table.userId),
  ],
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("account_user_id_idx").on(table.userId),
    uniqueIndex("account_provider_account_unique").on(table.providerId, table.accountId),
  ],
);

export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const albums = sqliteTable(
  "albums",
  {
    id: text("id").primaryKey(),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    message: text("message").default("").notNull(),
    eventDate: text("event_date"),
    passphraseSalt: text("passphrase_salt").notNull(),
    passphraseHash: text("passphrase_hash").notNull(),
    accessVersion: integer("access_version").default(1).notNull(),
    expectedViewers: integer("expected_viewers").default(1).notNull(),
    allowDownloads: integer("allow_downloads", { mode: "boolean" }).default(true).notNull(),
    allowContributions: integer("allow_contributions", { mode: "boolean" })
      .default(false)
      .notNull(),
    active: integer("active", { mode: "boolean" }).default(true).notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("albums_slug_unique").on(table.slug),
    index("albums_owner_created_idx").on(table.ownerUserId, table.createdAt),
    index("albums_expires_idx").on(table.expiresAt),
  ],
);

export const photos = sqliteTable(
  "photos",
  {
    id: text("id").primaryKey(),
    albumId: text("album_id")
      .notNull()
      .references(() => albums.id, { onDelete: "cascade" }),
    originalKey: text("original_key").notNull(),
    thumbnailKey: text("thumbnail_key").notNull(),
    filename: text("filename").notNull(),
    mimeType: text("mime_type", { enum: ["image/jpeg", "image/png", "image/webp"] }).notNull(),
    byteSize: integer("byte_size").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    uploadedBy: text("uploaded_by", { enum: ["owner", "guest"] }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("photos_album_created_idx").on(table.albumId, table.createdAt),
    uniqueIndex("photos_original_key_unique").on(table.originalKey),
    uniqueIndex("photos_thumbnail_key_unique").on(table.thumbnailKey),
  ],
);

export const albumVisitors = sqliteTable(
  "album_visitors",
  {
    id: text("id").primaryKey(),
    albumId: text("album_id")
      .notNull()
      .references(() => albums.id, { onDelete: "cascade" }),
    viewerHash: text("viewer_hash").notNull(),
    unlockedAt: integer("unlocked_at", { mode: "timestamp" }).notNull(),
    firstViewedAt: integer("first_viewed_at", { mode: "timestamp" }),
    firstDownloadedAt: integer("first_downloaded_at", { mode: "timestamp" }),
  },
  (table) => [
    uniqueIndex("album_visitors_album_viewer_unique").on(table.albumId, table.viewerHash),
    index("album_visitors_album_idx").on(table.albumId),
  ],
);

export const authSchema = { account, session, user, verification };
export const schema = { ...authSchema, albums, albumVisitors, photos };

export type Album = typeof albums.$inferSelect;
export type Photo = typeof photos.$inferSelect;
export type AlbumVisitor = typeof albumVisitors.$inferSelect;
