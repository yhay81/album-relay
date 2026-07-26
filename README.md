# Album Relay

撮影会・園行事・小規模イベントの写真を、受取側の登録なしでQRと合い言葉から閲覧・保存できる期限付き納品アルバムです。30days Album/SUZURIアルバム等を使う日本の小規模カメラマン10名による実案件で、置き換え可能性を検証します。

- 本番: <https://album-relay.yusuke8h.workers.dev>
- ソース: <https://github.com/yhay81/album-relay>
- 検証台帳: <https://github.com/yhay81/album-relay/issues/1>
- 状態: 10名限定の招待制パイロット

## Product

- 所有者: Better Authでログインし、QR、合い言葉、7/14/30日の期限、DL・共同投稿権限を設定。
- 受取人: 登録なし。合い言葉を解除し、サムネイル閲覧、原本個別保存、ストリーミングZIP保存。
- 写真: 非公開Cloudflare R2に原本とブラウザ生成サムネイルを保存。公開バケットURLは使わない。
- 安全性: scrypt合い言葉ハッシュ、署名付きHttpOnly access cookie、Turnstile、用途別rate limit、MIME magic byte検査。
- 計測: 個人を識別しないアルバム単位の解除・閲覧・DL完了人数だけをD1へ保存。
- 削除: 所有者の手動削除またはcronによる期限後削除。R2とD1をまとめて消す。

技術構成はCloudflare Workers、D1、R2、Hono、Hono JSX、Better Auth、Drizzle ORM、Vite+です。

## Local development

```powershell
vp env off
Copy-Item .dev.vars.example .dev.vars
npm ci
npx wrangler d1 migrations apply album-relay --local
npm run dev
```

`.dev.vars`の秘密値はローカル専用です。32文字以上のランダム値へ変更してください。

## Quality gate

```powershell
npm run check
npm test
npm run build
npm audit --audit-level=moderate
```

## Cloudflare setup

初回はD1と非公開R2 bucketを作り、D1 IDを`wrangler.jsonc`へ設定します。

```powershell
npx wrangler d1 create album-relay --location apac
npx wrangler r2 bucket create album-relay-photos --location apac
npx wrangler d1 migrations apply album-relay --remote
```

Better Auth、アルバムaccess token、招待、Turnstileの秘密値はCloudflare Secretsへ登録します。

```powershell
npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put ALBUM_ACCESS_SECRET
npx wrangler secret put PILOT_INVITE_CODE
npx wrangler secret put TURNSTILE_SECRET_KEY
```

## Deployment

```powershell
npm run deploy
```

判定条件は[EXPERIMENT.md](./EXPERIMENT.md)、実案件運用は[PILOT.md](./PILOT.md)、公開・障害・削除確認は[OPERATIONS.md](./OPERATIONS.md)を参照してください。
