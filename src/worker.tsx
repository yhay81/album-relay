import { Hono } from "hono";
import type { Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { setCookie } from "hono/cookie";
import { requestId } from "hono/request-id";
import { renderSVG } from "uqr";

import type { Bindings } from "./bindings";
import {
  createDatabase,
  deleteOwnerAccount,
  findAlbumByOwner,
  findAlbumBySlug,
  findPhoto,
  getAlbumMetrics,
  listAlbumsByOwner,
  listPhotos,
  markVisitorDownloaded,
  markVisitorViewed,
  registerVisitor,
  saveAlbum,
} from "./db/queries";
import type { Album } from "./db/schema";
import { getTextField, InputError, isSameOrigin, parseAlbumInput } from "./domain/album";
import { securityHeaders } from "./middleware/security";
import {
  createAlbumAccessToken,
  hashPassphrase,
  hashViewerId,
  verifyAlbumAccessToken,
  verifyPassphrase,
} from "./security/album-access";
import { createAuth } from "./services/auth";
import {
  cleanupExpiredAlbums,
  getAlbumZip,
  getStoredObject,
  removeAlbum,
  removePhoto,
  storePhoto,
} from "./services/storage";
import { verifyTurnstile } from "./services/turnstile";
import {
  AlbumEditorPage,
  AuthPage,
  DashboardPage,
  ErrorPage,
  GalleryPage,
  HomePage,
  PrivacyPage,
  UnlockPage,
} from "./ui/pages";

const ACCESS_COOKIE = "album-relay.access";
const MAX_FORM_BYTES = 25 * 1024 * 1024;
type AppContext = Context<{ Bindings: Bindings }>;

const app = new Hono<{ Bindings: Bindings }>();

app.use("*", requestId());
app.use("*", securityHeaders);
app.use(
  "/api/auth/*",
  bodyLimit({
    maxSize: 16 * 1024,
    onError: (c) => c.json({ message: "入力サイズが大きすぎます。" }, 413),
  }),
);
app.use(
  "/dashboard/*",
  bodyLimit({
    maxSize: MAX_FORM_BYTES,
    onError: (c) => c.json({ message: "写真は1枚20MB以内にしてください。" }, 413),
  }),
);
app.use(
  "/a/:slug/*",
  bodyLimit({
    maxSize: MAX_FORM_BYTES,
    onError: (c) => c.json({ message: "写真は1枚20MB以内にしてください。" }, 413),
  }),
);

app.get("/", (c) => c.html(<HomePage />));
app.get("/privacy", (c) => c.html(<PrivacyPage />));
app.get("/login", (c) =>
  c.html(<AuthPage mode="login" registered={c.req.query("registered") === "1"} />),
);
app.get("/signup", (c) =>
  c.html(<AuthPage mode="signup" turnstileSiteKey={c.env.PUBLIC_TURNSTILE_SITE_KEY} />),
);

app.on(["GET", "POST"], "/api/auth/*", async (c) => {
  if (c.req.method === "POST" && new URL(c.req.url).pathname.endsWith("/sign-up/email")) {
    const clientKey = `${c.req.header("cf-connecting-ip") ?? "unknown"}:signup`;
    const rate = await c.env.SIGNUP_RATE_LIMITER.limit({ key: clientKey });
    if (!rate.success) {
      return c.json({ message: "登録試行が多すぎます。1分ほど待ってください。" }, 429);
    }
  }
  return createAuth(c.env, new URL(c.req.url).origin).handler(c.req.raw);
});

app.get("/dashboard", async (c) => {
  const session = await getOwnerSession(c.env, c.req.raw);
  if (!session) return c.redirect("/login", 303);
  const database = createDatabase(c.env);
  const ownerAlbums = await listAlbumsByOwner(database, session.user.id);
  const metricPairs = await Promise.all(
    ownerAlbums.map(
      async (album) => [album.id, await getAlbumMetrics(database, album.id)] as const,
    ),
  );
  c.header("Cache-Control", "private, no-store");
  return c.html(
    <DashboardPage
      albums={ownerAlbums}
      metrics={Object.fromEntries(metricPairs)}
      userName={session.user.name}
    />,
  );
});

app.get("/dashboard/albums/new", async (c) => {
  const session = await getOwnerSession(c.env, c.req.raw);
  if (!session) return c.redirect("/login", 303);
  c.header("Cache-Control", "private, no-store");
  return c.html(<AlbumEditorPage origin={new URL(c.req.url).origin} photos={[]} />);
});

app.post("/dashboard/albums", async (c) => {
  const session = await requireOwnerWrite(c.env, c.req.raw);
  if (session instanceof Response) return session;
  try {
    const input = parseAlbumInput(await c.req.formData());
    const credentials = await hashPassphrase(input.passphrase);
    const album = await saveAlbum(createDatabase(c.env), session.user.id, input, credentials);
    return c.redirect(`/dashboard/albums/${album?.id}`, 303);
  } catch (error) {
    return albumInputError(c, error);
  }
});

app.get("/dashboard/albums/:id", async (c) => {
  const session = await getOwnerSession(c.env, c.req.raw);
  if (!session) return c.redirect("/login", 303);
  const database = createDatabase(c.env);
  const album = await findAlbumByOwner(database, session.user.id, c.req.param("id"));
  if (!album)
    return c.html(<ErrorPage message="アルバムが見つかりません。" title="見つかりません" />, 404);
  const [albumPhotos, metrics] = await Promise.all([
    listPhotos(database, album.id),
    getAlbumMetrics(database, album.id),
  ]);
  c.header("Cache-Control", "private, no-store");
  return c.html(
    <AlbumEditorPage
      album={album}
      metrics={metrics}
      origin={new URL(c.req.url).origin}
      photos={albumPhotos}
    />,
  );
});

app.post("/dashboard/albums/:id", async (c) => {
  const session = await requireOwnerWrite(c.env, c.req.raw);
  if (session instanceof Response) return session;
  const database = createDatabase(c.env);
  const existing = await findAlbumByOwner(database, session.user.id, c.req.param("id"));
  if (!existing) return c.json({ error: "not_found" }, 404);
  try {
    const input = parseAlbumInput(await c.req.formData(), existing);
    const credentials = input.passphrase ? await hashPassphrase(input.passphrase) : null;
    await saveAlbum(database, session.user.id, input, credentials, existing.id);
    return c.redirect(`/dashboard/albums/${existing.id}`, 303);
  } catch (error) {
    return albumInputError(c, error);
  }
});

app.post("/dashboard/albums/:id/photos", async (c) => {
  const session = await requireOwnerWrite(c.env, c.req.raw);
  if (session instanceof Response) return session;
  const database = createDatabase(c.env);
  const album = await findAlbumByOwner(database, session.user.id, c.req.param("id"));
  if (!album) return c.json({ message: "アルバムが見つかりません。" }, 404);
  try {
    const photo = await storePhoto(c.env, database, album, await c.req.formData(), "owner");
    return c.json(photo, 201);
  } catch (error) {
    if (error instanceof InputError) return c.json({ message: error.message }, 400);
    throw error;
  }
});

app.get("/dashboard/albums/:id/photos/:photoId/thumb", async (c) => {
  const session = await getOwnerSession(c.env, c.req.raw);
  if (!session) return c.json({ error: "unauthorized" }, 401);
  const database = createDatabase(c.env);
  const album = await findAlbumByOwner(database, session.user.id, c.req.param("id"));
  if (!album) return c.json({ error: "not_found" }, 404);
  const photo = await findPhoto(database, album.id, c.req.param("photoId"));
  if (!photo) return c.json({ error: "not_found" }, 404);
  return storedPhotoResponse(c.env, photo.thumbnailKey, photo.filename, false);
});

app.get("/dashboard/albums/:id/download-all", async (c) => {
  const session = await getOwnerSession(c.env, c.req.raw);
  if (!session) return c.json({ error: "unauthorized" }, 401);
  const database = createDatabase(c.env);
  const album = await findAlbumByOwner(database, session.user.id, c.req.param("id"));
  if (!album) return c.json({ error: "not_found" }, 404);
  return getAlbumZip(c.env, database, album);
});

app.post("/dashboard/albums/:id/photos/:photoId/delete", async (c) => {
  const session = await requireOwnerWrite(c.env, c.req.raw);
  if (session instanceof Response) return session;
  const database = createDatabase(c.env);
  const album = await findAlbumByOwner(database, session.user.id, c.req.param("id"));
  if (!album) return c.json({ error: "not_found" }, 404);
  await removePhoto(c.env, database, album.id, c.req.param("photoId"));
  return c.redirect(`/dashboard/albums/${album.id}`, 303);
});

app.get("/dashboard/albums/:id/qr", async (c) => {
  const session = await getOwnerSession(c.env, c.req.raw);
  if (!session) return c.json({ error: "unauthorized" }, 401);
  const album = await findAlbumByOwner(createDatabase(c.env), session.user.id, c.req.param("id"));
  if (!album) return c.json({ error: "not_found" }, 404);
  const albumUrl = `${new URL(c.req.url).origin}/a/${album.slug}`;
  const svg = renderSVG(albumUrl, {
    border: 2,
    ecc: "M",
  });
  c.header("Cache-Control", "private, no-store");
  c.header("Content-Type", "image/svg+xml; charset=utf-8");
  return c.body(svg);
});

app.post("/dashboard/albums/:id/delete", async (c) => {
  const session = await requireOwnerWrite(c.env, c.req.raw);
  if (session instanceof Response) return session;
  const database = createDatabase(c.env);
  const album = await findAlbumByOwner(database, session.user.id, c.req.param("id"));
  if (!album) return c.json({ error: "not_found" }, 404);
  await removeAlbum(c.env, database, album.id);
  return c.redirect("/dashboard", 303);
});

app.post("/dashboard/account/delete", async (c) => {
  const session = await requireOwnerWrite(c.env, c.req.raw);
  if (session instanceof Response) return session;
  const formData = await c.req.formData();
  if (getTextField(formData, "confirmation") !== "すべて削除") {
    return c.html(
      <ErrorPage
        message="確認欄へ「すべて削除」と入力してください。"
        title="削除できませんでした"
      />,
      400,
    );
  }
  const database = createDatabase(c.env);
  const ownerAlbums = await listAlbumsByOwner(database, session.user.id);
  for (const album of ownerAlbums) await removeAlbum(c.env, database, album.id);
  await deleteOwnerAccount(database, session.user.id);
  clearAccessCookie(c);
  return c.redirect("/?deleted=1", 303);
});

app.get("/a/:slug", async (c) => {
  const database = createDatabase(c.env);
  const album = await findActiveAlbum(database, c.req.param("slug"));
  if (!album) return albumUnavailable(c);
  const access = await getAlbumAccess(c.env, c.req.raw, album);
  if (!access) {
    return c.html(<UnlockPage album={album} turnstileSiteKey={c.env.PUBLIC_TURNSTILE_SITE_KEY} />);
  }
  const viewerHash = await hashViewerId(c.env.ALBUM_ACCESS_SECRET, access.viewerId);
  await markVisitorViewed(database, album.id, viewerHash);
  const albumPhotos = await listPhotos(database, album.id);
  c.header("Cache-Control", "private, no-store");
  return c.html(<GalleryPage album={album} photos={albumPhotos} />);
});

app.post("/a/:slug/unlock", async (c) => {
  if (!isSameOrigin(c.req.raw)) return c.json({ error: "invalid_origin" }, 403);
  const database = createDatabase(c.env);
  const album = await findActiveAlbum(database, c.req.param("slug"));
  if (!album) return albumUnavailable(c);
  const clientKey = `${c.req.header("cf-connecting-ip") ?? "unknown"}:unlock:${album.id}`;
  const rate = await c.env.UNLOCK_RATE_LIMITER.limit({ key: clientKey });
  const formData = await c.req.formData();
  const turnstileSiteKey = c.env.PUBLIC_TURNSTILE_SITE_KEY;
  if (!rate.success) {
    return c.html(
      <UnlockPage
        album={album}
        error="試行回数が多すぎます。1分ほど待ってください。"
        turnstileSiteKey={turnstileSiteKey}
      />,
      429,
    );
  }
  const turnstile = await verifyTurnstile(
    c.env,
    getTextField(formData, "cf-turnstile-response"),
    c.get("requestId"),
  );
  const valid = turnstile
    ? await verifyPassphrase(
        getTextField(formData, "passphrase"),
        album.passphraseSalt,
        album.passphraseHash,
      )
    : false;
  if (!valid) {
    return c.html(
      <UnlockPage
        album={album}
        error="合い言葉または安全確認を確認してください。"
        turnstileSiteKey={turnstileSiteKey}
      />,
      403,
    );
  }

  const accessExpiry = new Date(
    Math.min(album.expiresAt.getTime(), Date.now() + 12 * 60 * 60 * 1000),
  );
  const access = await createAlbumAccessToken(
    c.env.ALBUM_ACCESS_SECRET,
    album.id,
    album.accessVersion,
    accessExpiry,
  );
  const viewerHash = await hashViewerId(c.env.ALBUM_ACCESS_SECRET, access.viewerId);
  await registerVisitor(database, album.id, viewerHash);
  setCookie(c, ACCESS_COOKIE, access.token, {
    httpOnly: true,
    maxAge: Math.max(1, Math.floor((accessExpiry.getTime() - Date.now()) / 1000)),
    path: "/",
    sameSite: "Lax",
    secure: new URL(c.req.url).protocol === "https:",
  });
  return c.redirect(`/a/${album.slug}`, 303);
});

app.post("/a/:slug/photos", async (c) => {
  if (!isSameOrigin(c.req.raw)) return c.json({ error: "invalid_origin" }, 403);
  const database = createDatabase(c.env);
  const album = await findActiveAlbum(database, c.req.param("slug"));
  if (!album) return c.json({ message: "アルバムが見つかりません。" }, 404);
  const access = await getAlbumAccess(c.env, c.req.raw, album);
  if (!access) return c.json({ message: "合い言葉をもう一度入力してください。" }, 401);
  if (!album.allowContributions) return c.json({ message: "共同投稿は停止中です。" }, 403);
  const clientKey = `${c.req.header("cf-connecting-ip") ?? "unknown"}:upload:${album.id}`;
  const rate = await c.env.UPLOAD_RATE_LIMITER.limit({ key: clientKey });
  if (!rate.success) return c.json({ message: "送信が多すぎます。少し待ってください。" }, 429);
  try {
    const photo = await storePhoto(c.env, database, album, await c.req.formData(), "guest");
    return c.json(photo, 201);
  } catch (error) {
    if (error instanceof InputError) return c.json({ message: error.message }, 400);
    throw error;
  }
});

app.get("/a/:slug/photos/:photoId/thumb", async (c) =>
  publicPhoto(c.env, c.req.raw, c.req.param("slug"), c.req.param("photoId"), false),
);

app.get("/a/:slug/photos/:photoId/original", async (c) =>
  publicPhoto(c.env, c.req.raw, c.req.param("slug"), c.req.param("photoId"), true),
);

app.get("/a/:slug/download-all", async (c) => {
  const database = createDatabase(c.env);
  const album = await findActiveAlbum(database, c.req.param("slug"));
  if (!album?.allowDownloads) return c.json({ error: "not_found" }, 404);
  const access = await getAlbumAccess(c.env, c.req.raw, album);
  if (!access) return c.redirect(`/a/${c.req.param("slug")}`, 303);
  const viewerHash = await hashViewerId(c.env.ALBUM_ACCESS_SECRET, access.viewerId);
  await markVisitorDownloaded(database, album.id, viewerHash);
  return getAlbumZip(c.env, database, album);
});

app.get("/healthz", (c) =>
  c.json({
    healthy: true,
    service: "album-relay",
    time: new Date().toISOString(),
  }),
);

app.notFound((c) => c.json({ error: "not_found", requestId: c.get("requestId") }, 404));

app.onError((error, c) => {
  console.error(
    JSON.stringify({
      event: "request_failed",
      message: error.message,
      requestId: c.get("requestId"),
    }),
  );
  return c.json({ error: "internal_error", requestId: c.get("requestId") }, 500);
});

async function publicPhoto(
  env: Bindings,
  request: Request,
  slug: string,
  photoId: string,
  original: boolean,
) {
  const database = createDatabase(env);
  const album = await findActiveAlbum(database, slug);
  if (!album || (original && !album.allowDownloads)) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  const access = await getAlbumAccess(env, request, album);
  if (!access) return Response.json({ error: "unauthorized" }, { status: 401 });
  const photo = await findPhoto(database, album.id, photoId);
  if (!photo) return Response.json({ error: "not_found" }, { status: 404 });
  if (original) {
    const viewerHash = await hashViewerId(env.ALBUM_ACCESS_SECRET, access.viewerId);
    await markVisitorDownloaded(database, album.id, viewerHash);
  }
  return storedPhotoResponse(
    env,
    original ? photo.originalKey : photo.thumbnailKey,
    photo.filename,
    original,
  );
}

async function storedPhotoResponse(
  env: Bindings,
  key: string,
  filename: string,
  download: boolean,
) {
  const object = await getStoredObject(env.PHOTOS, key);
  if (!object) return Response.json({ error: "not_found" }, { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Cache-Control", download ? "private, no-store" : "private, max-age=300");
  headers.set("ETag", object.httpEtag);
  if (download) {
    headers.set(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
  }
  return new Response(object.body, { headers });
}

async function findActiveAlbum(database: ReturnType<typeof createDatabase>, slug: string) {
  const album = await findAlbumBySlug(database, slug);
  if (!album?.active || album.expiresAt <= new Date()) return null;
  return album;
}

async function getAlbumAccess(env: Bindings, request: Request, album: Album) {
  const cookie = readCookie(request, ACCESS_COOKIE);
  return verifyAlbumAccessToken(env.ALBUM_ACCESS_SECRET, cookie, album.id, album.accessVersion);
}

async function getOwnerSession(env: Bindings, request: Request) {
  return createAuth(env, new URL(request.url).origin).api.getSession({
    headers: request.headers,
  });
}

async function requireOwnerWrite(env: Bindings, request: Request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "invalid_origin" }, { status: 403 });
  }
  const session = await getOwnerSession(env, request);
  return session ?? Response.redirect(`${new URL(request.url).origin}/login`, 303);
}

function albumInputError(c: AppContext, error: unknown) {
  if (error instanceof InputError) {
    return c.html(
      <ErrorPage message={error.message} title="アルバムを保存できませんでした" />,
      400,
    );
  }
  if (error instanceof Error && error.message.includes("UNIQUE")) {
    return c.html(
      <ErrorPage
        message="そのURL名はすでに使われています。別の名前を選んでください。"
        title="アルバムを保存できませんでした"
      />,
      409,
    );
  }
  throw error;
}

function albumUnavailable(c: AppContext) {
  return c.html(
    <ErrorPage
      message="このアルバムは存在しないか、受付を停止したか、公開期限を過ぎています。"
      title="アルバムを開けません"
    />,
    404,
  );
}

function clearAccessCookie(c: AppContext) {
  setCookie(c, ACCESS_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "Lax",
    secure: new URL(c.req.url).protocol === "https:",
  });
}

function readCookie(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return undefined;
  for (const item of cookieHeader.split(";")) {
    const [key, ...value] = item.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return undefined;
}

const worker: ExportedHandler<Bindings> = {
  fetch: app.fetch,
  scheduled(_controller, env, context) {
    context.waitUntil(cleanupExpiredAlbums(env, createDatabase(env)));
  },
};

export { app };
export default worker;
