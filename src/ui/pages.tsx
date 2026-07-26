import type { Album, Photo } from "../db/schema";
import { product } from "../config/product";
import { Layout } from "./layout";

export type AlbumMetrics = {
  downloaded: number;
  unlocked: number;
  viewed: number;
};

type NoticeProps = {
  children: string;
  tone?: "error" | "success";
};

function Notice({ children, tone = "error" }: NoticeProps) {
  return (
    <p aria-live="polite" class={`notice ${tone}`} role={tone === "error" ? "alert" : "status"}>
      {children}
    </p>
  );
}

export function HomePage() {
  return (
    <Layout>
      <section class="hero">
        <p class="eyebrow">PHOTO DELIVERY, WITHOUT THE APP</p>
        <h1>QRを渡す。合い言葉を入れる。写真が届く。</h1>
        <p class="lead">
          撮影会、園行事、小規模イベント向け。受取側の登録やアプリを求めず、原本をまとめて渡せる期限付き写真アルバムです。
        </p>
        <div class="actions">
          <a class="button primary" href="/signup">
            カメラマンパイロットに参加
          </a>
          <a class="button secondary" href="#experiment">
            判定条件を見る
          </a>
        </div>
      </section>
      <section class="feature-grid" aria-label="特徴">
        <article>
          <span>01</span>
          <h2>受取側は登録不要</h2>
          <p>QRと合い言葉だけ。アプリのインストールやSNSアカウントを求めません。</p>
        </article>
        <article>
          <span>02</span>
          <h2>原本も一括で保存</h2>
          <p>スマホの個別保存と、PC向けストリーミングZIPを同じアルバムから提供します。</p>
        </article>
        <article>
          <span>03</span>
          <h2>期限が来たら消える</h2>
          <p>写真は非公開R2へ保存し、7・14・30日の期限後に自動削除します。</p>
        </article>
      </section>
      <section class="panel" id="experiment">
        <p class="eyebrow">PUBLIC EXPERIMENT</p>
        <h2>実案件の完了率で判断します。</h2>
        <dl class="metrics">
          <div>
            <dt>対象</dt>
            <dd>月5件以上アルバムを作る小規模カメラマン10名</dd>
          </div>
          <div>
            <dt>期限</dt>
            <dd>{product.experiment.deadline}</dd>
          </div>
          <div>
            <dt>成功</dt>
            <dd>{product.experiment.success}</dd>
          </div>
        </dl>
      </section>
    </Layout>
  );
}

export function AuthPage({
  mode,
  registered = false,
}: {
  mode: "login" | "signup";
  registered?: boolean;
}) {
  const signup = mode === "signup";
  return (
    <Layout scripts={["/app.js"]} title={`${signup ? "参加登録" : "ログイン"} | ${product.name}`}>
      <section class="auth-card">
        <p class="eyebrow">{signup ? "PILOT ACCESS" : "WELCOME BACK"}</p>
        <h1>{signup ? "納品アルバムを始める" : "管理画面をひらく"}</h1>
        <p>
          {signup
            ? "現在はカメラマン10名の招待制です。"
            : "登録したメールアドレスでログインします。"}
        </p>
        {registered && <Notice tone="success">登録できました。続けてログインしてください。</Notice>}
        <form class="stack" data-auth-form={mode}>
          {signup && (
            <label>
              表示名
              <input autocomplete="name" maxlength={50} name="name" required type="text" />
            </label>
          )}
          <label>
            メールアドレス
            <input autocomplete="email" name="email" required type="email" />
          </label>
          <label>
            パスワード
            <input
              autocomplete={signup ? "new-password" : "current-password"}
              minlength={12}
              name="password"
              required
              type="password"
            />
            {signup && <small>12文字以上。ほかのサービスと同じものは使わないでください。</small>}
          </label>
          {signup && (
            <label>
              招待コード
              <input autocomplete="off" name="inviteCode" required type="text" />
            </label>
          )}
          <p aria-live="polite" class="notice hidden" data-auth-status role="status"></p>
          <button class="button primary" type="submit">
            {signup ? "登録する" : "ログイン"}
          </button>
        </form>
        <p>
          {signup ? (
            <a href="/login">登録済みの方</a>
          ) : (
            <a href="/signup">招待コードをお持ちの方</a>
          )}
        </p>
      </section>
    </Layout>
  );
}

export function DashboardPage({
  albums,
  metrics,
  userName,
}: {
  albums: Album[];
  metrics: Record<string, AlbumMetrics>;
  userName: string;
}) {
  return (
    <Layout scripts={["/app.js"]} title={`管理画面 | ${product.name}`}>
      <section class="dashboard-head">
        <div>
          <p class="eyebrow">DASHBOARD</p>
          <h1>{userName}さんのアルバム</h1>
        </div>
        <div class="actions">
          <a class="button primary" href="/dashboard/albums/new">
            新しいアルバム
          </a>
          <button class="button secondary" data-sign-out type="button">
            ログアウト
          </button>
        </div>
      </section>
      {albums.length === 0 ? (
        <div class="empty-state">
          <h2>最初の実案件をつくりましょう。</h2>
          <p>QR、合い言葉、公開期限を決めたら写真を追加できます。</p>
          <a class="button primary" href="/dashboard/albums/new">
            アルバムを作成
          </a>
        </div>
      ) : (
        <div class="album-list">
          {albums.map((album) => {
            const result = metrics[album.id] ?? { downloaded: 0, unlocked: 0, viewed: 0 };
            return (
              <article class="album-card">
                <div>
                  <span class={`status ${album.active ? "active" : "paused"}`}>
                    {album.active ? "受付中" : "停止中"}
                  </span>
                  <h2>{album.title}</h2>
                  <p>/a/{album.slug}</p>
                </div>
                <dl class="compact-metrics">
                  <div>
                    <dt>招待</dt>
                    <dd>{album.expectedViewers}</dd>
                  </div>
                  <div>
                    <dt>解除</dt>
                    <dd>{result.unlocked}</dd>
                  </div>
                  <div>
                    <dt>閲覧</dt>
                    <dd>{result.viewed}</dd>
                  </div>
                  <div>
                    <dt>DL</dt>
                    <dd>{result.downloaded}</dd>
                  </div>
                </dl>
                <a class="button secondary" href={`/dashboard/albums/${album.id}`}>
                  管理する
                </a>
              </article>
            );
          })}
        </div>
      )}
      <details class="danger-zone account-danger">
        <summary>アカウントと全写真を削除</summary>
        <p>すべてのR2原本、サムネイル、アルバム、認証情報を削除します。取り消せません。</p>
        <form action="/dashboard/account/delete" class="stack" method="post">
          <label>
            確認のため「すべて削除」と入力
            <input name="confirmation" pattern="すべて削除" required type="text" />
          </label>
          <button class="button danger" type="submit">
            完全に削除
          </button>
        </form>
      </details>
    </Layout>
  );
}

type AlbumEditorPageProps = {
  album?: Album;
  metrics?: AlbumMetrics;
  origin: string;
  photos: Photo[];
};

export function AlbumEditorPage({ album, metrics, origin, photos }: AlbumEditorPageProps) {
  const editing = Boolean(album);
  const expiresDays = album
    ? Math.max(7, Math.round((album.expiresAt.getTime() - Date.now()) / 86_400_000))
    : 14;
  return (
    <Layout
      scripts={["/app.js"]}
      title={`${editing ? "アルバム管理" : "新規作成"} | ${product.name}`}
    >
      <section class="dashboard-head compact">
        <div>
          <p class="eyebrow">{editing ? "ALBUM CONTROL" : "NEW ALBUM"}</p>
          <h1>{editing ? album?.title : "納品アルバムをつくる"}</h1>
        </div>
        <a class="button secondary" href="/dashboard">
          一覧へ戻る
        </a>
      </section>
      <section class="editor-grid">
        <aside class="settings-card">
          <h2>公開設定</h2>
          <form
            action={album ? `/dashboard/albums/${album.id}` : "/dashboard/albums"}
            class="stack"
            method="post"
          >
            <label>
              アルバム名
              <input maxlength={80} name="title" required type="text" value={album?.title ?? ""} />
            </label>
            <label>
              URL名
              <span class="input-prefix">
                <span>/a/</span>
                <input
                  maxlength={40}
                  minlength={3}
                  name="slug"
                  pattern="[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?"
                  required
                  type="text"
                  value={album?.slug ?? ""}
                />
              </span>
            </label>
            <label>
              撮影日
              <input name="eventDate" type="date" value={album?.eventDate ?? ""} />
            </label>
            <label>
              受取人への案内
              <textarea maxlength={400} name="message" rows={4}>
                {album?.message ?? ""}
              </textarea>
            </label>
            <label>
              合い言葉
              <input
                autocomplete="new-password"
                minlength={6}
                name="passphrase"
                placeholder={editing ? "変更する場合だけ入力" : "6文字以上"}
                required={!editing}
                type="password"
              />
            </label>
            <label>
              招待予定人数
              <input
                max={500}
                min={1}
                name="expectedViewers"
                required
                type="number"
                value={album?.expectedViewers ?? 20}
              />
            </label>
            <label>
              公開期間
              <select name="expiresDays">
                <option selected={expiresDays <= 7} value="7">
                  7日
                </option>
                <option selected={expiresDays > 7 && expiresDays <= 14} value="14">
                  14日
                </option>
                <option selected={expiresDays > 14} value="30">
                  30日
                </option>
              </select>
            </label>
            <label class="check-row">
              <input checked={album?.active ?? true} name="active" type="checkbox" />
              公開する
            </label>
            <label class="check-row">
              <input
                checked={album?.allowDownloads ?? true}
                name="allowDownloads"
                type="checkbox"
              />
              原本ダウンロードを許可
            </label>
            <label class="check-row">
              <input
                checked={album?.allowContributions ?? false}
                name="allowContributions"
                type="checkbox"
              />
              受取人の共同投稿を許可
            </label>
            <button class="button primary" type="submit">
              {editing ? "設定を保存" : "作成して写真を追加"}
            </button>
          </form>
          {album && (
            <details class="danger-zone">
              <summary>このアルバムを削除</summary>
              <form action={`/dashboard/albums/${album.id}/delete`} method="post">
                <button class="text-button danger-text" type="submit">
                  原本を含めて削除
                </button>
              </form>
            </details>
          )}
        </aside>
        <div class="editor-main">
          {album && metrics && (
            <>
              <section class="share-panel">
                <div>
                  <p class="eyebrow">SHARE</p>
                  <h2>QRと合い言葉を別々に渡す</h2>
                  <a href={`${origin}/a/${album.slug}`}>
                    {origin}/a/{album.slug}
                  </a>
                  <p>合い言葉はQRに埋め込まれません。</p>
                </div>
                <a href={`/dashboard/albums/${album.id}/qr`} target="_blank">
                  <img
                    alt={`${album.title}の共有QRコード`}
                    class="qr"
                    src={`/dashboard/albums/${album.id}/qr`}
                  />
                </a>
              </section>
              <dl class="summary-grid">
                <div>
                  <dt>招待</dt>
                  <dd>{album.expectedViewers}</dd>
                </div>
                <div>
                  <dt>解除</dt>
                  <dd>{metrics.unlocked}</dd>
                </div>
                <div>
                  <dt>閲覧</dt>
                  <dd>{metrics.viewed}</dd>
                </div>
                <div>
                  <dt>DL</dt>
                  <dd>{metrics.downloaded}</dd>
                </div>
              </dl>
              <section class="upload-panel">
                <p class="eyebrow">UPLOAD</p>
                <h2>写真を追加</h2>
                <form
                  class="stack"
                  data-upload-form
                  data-upload-url={`/dashboard/albums/${album.id}/photos`}
                >
                  <label>
                    JPEG・PNG・WebP（1枚20MB、合計2,000枚まで）
                    <input
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      name="photos"
                      required
                      type="file"
                    />
                  </label>
                  <p aria-live="polite" class="upload-status" data-upload-status></p>
                  <progress class="hidden" data-upload-progress max="100" value="0"></progress>
                  <button class="button primary" type="submit">
                    選んだ写真を追加
                  </button>
                </form>
              </section>
              <section>
                <div class="section-heading">
                  <div>
                    <p class="eyebrow">PHOTOS</p>
                    <h2>{photos.length}枚</h2>
                  </div>
                  {photos.length > 0 && album.allowDownloads && (
                    <a class="button secondary" href={`/dashboard/albums/${album.id}/download-all`}>
                      ZIP動作確認
                    </a>
                  )}
                </div>
                <div class="photo-grid owner-grid">
                  {photos.map((photo) => (
                    <article class="photo-card">
                      <img
                        alt=""
                        loading="lazy"
                        src={`/dashboard/albums/${album.id}/photos/${photo.id}/thumb`}
                      />
                      <div>
                        <p>{photo.filename}</p>
                        <form
                          action={`/dashboard/albums/${album.id}/photos/${photo.id}/delete`}
                          method="post"
                        >
                          <button class="text-button" type="submit">
                            削除
                          </button>
                        </form>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </section>
    </Layout>
  );
}

export function UnlockPage({
  album,
  error,
  turnstileSiteKey,
}: {
  album: Album;
  error?: string;
  turnstileSiteKey: string | undefined;
}) {
  const scripts = turnstileSiteKey ? ["https://challenges.cloudflare.com/turnstile/v0/api.js"] : [];
  return (
    <Layout scripts={scripts} title={`${album.title} | ${product.name}`}>
      <section class="unlock-card">
        <p class="eyebrow">PRIVATE ALBUM</p>
        <h1>{album.title}</h1>
        {album.eventDate && <p>撮影日: {formatDateOnly(album.eventDate)}</p>}
        {album.message && <p class="preserve-lines">{album.message}</p>}
        {error && <Notice>{error}</Notice>}
        <form action={`/a/${album.slug}/unlock`} class="stack" method="post">
          <label>
            合い言葉
            <input autocomplete="off" name="passphrase" required type="password" />
          </label>
          {turnstileSiteKey && <div class="cf-turnstile" data-sitekey={turnstileSiteKey}></div>}
          <button class="button primary" type="submit">
            アルバムを見る
          </button>
        </form>
        <p class="form-help">
          受取側の会員登録は必要ありません。合い言葉は撮影者へ確認してください。
        </p>
      </section>
    </Layout>
  );
}

export function GalleryPage({ album, photos }: { album: Album; photos: Photo[] }) {
  return (
    <Layout
      scripts={album.allowContributions ? ["/app.js"] : []}
      title={`${album.title} | ${product.name}`}
    >
      <section class="gallery-head">
        <div>
          <p class="eyebrow">DELIVERED ALBUM</p>
          <h1>{album.title}</h1>
          {album.message && <p class="lead preserve-lines">{album.message}</p>}
        </div>
        {album.allowDownloads && photos.length > 0 && (
          <a class="button primary" href={`/a/${album.slug}/download-all`}>
            すべてZIP保存
          </a>
        )}
      </section>
      {album.allowContributions && (
        <details class="contribution-panel">
          <summary>自分の写真も追加する</summary>
          <form class="stack" data-upload-form data-upload-url={`/a/${album.slug}/photos`}>
            <label>
              JPEG・PNG・WebP（1枚20MBまで）
              <input
                accept="image/jpeg,image/png,image/webp"
                multiple
                name="photos"
                required
                type="file"
              />
            </label>
            <p aria-live="polite" class="upload-status" data-upload-status></p>
            <progress class="hidden" data-upload-progress max="100" value="0"></progress>
            <button class="button secondary" type="submit">
              追加する
            </button>
          </form>
        </details>
      )}
      {photos.length === 0 ? (
        <div class="empty-state">
          <h2>写真の準備中です。</h2>
          <p>撮影者が追加すると、このページへ表示されます。</p>
        </div>
      ) : (
        <div class="photo-grid gallery-grid">
          {photos.map((photo) => (
            <figure>
              <img
                alt={photo.filename}
                loading="lazy"
                src={`/a/${album.slug}/photos/${photo.id}/thumb`}
              />
              {album.allowDownloads && (
                <figcaption>
                  <a href={`/a/${album.slug}/photos/${photo.id}/original`}>原本を保存</a>
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      )}
      <p class="expiry-note">
        公開期限: {formatDateTime(album.expiresAt)}。期限後、写真とアルバム情報は自動削除されます。
      </p>
    </Layout>
  );
}

export function PrivacyPage() {
  return (
    <Layout title={`プライバシー | ${product.name}`}>
      <article class="prose">
        <p class="eyebrow">PRIVACY</p>
        <h1>写真を、公開バケットへ置きません。</h1>
        <h2>保存するもの</h2>
        <p>
          所有者の認証情報、アルバム設定、暗号学的にハッシュ化した合い言葉、原本・サムネイル、匿名化した解除・閲覧・ダウンロード完了を保存します。
        </p>
        <h2>保存しないもの</h2>
        <p>
          閲覧者の氏名、メールアドレス、IPアドレスをアプリDBへ保存しません。合い言葉の平文も保存しません。写真を広告やAI学習用に販売しません。
        </p>
        <h2>期限と削除</h2>
        <p>
          所有者が選んだ7・14・30日の公開期限後、非公開R2の写真とD1の関連情報を自動削除します。所有者は期限前にもアルバムまたはアカウント全体を削除できます。
        </p>
      </article>
    </Layout>
  );
}

export function ErrorPage({ message, title }: { message: string; title: string }) {
  return (
    <Layout title={`${title} | ${product.name}`}>
      <section class="auth-card">
        <p class="eyebrow">NOTICE</p>
        <h1>{title}</h1>
        <p>{message}</p>
        <a class="button secondary" href="/">
          トップへ戻る
        </a>
      </section>
    </Layout>
  );
}

function formatDateOnly(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "long",
    timeZone: "Asia/Tokyo",
  }).format(new Date(`${value}T00:00:00+09:00`));
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Tokyo",
  }).format(value);
}
