# Operations

## One-time production setup

1. [x] APACにD1 `album-relay`と非公開R2 `album-relay-photos`を作成する。
2. [x] D1 IDを`wrangler.jsonc`へ設定し、remote migrationを適用する。
3. [x] Better Auth、album access、pilot invite、Turnstile secretsを登録する。
4. [x] Workers.devドメイン専用Turnstile widgetを作り、公開site keyを設定する。
5. [ ] private vulnerability reportingを有効化する。
6. [x] `npm run deploy`後、主要smoke testを本番で行う。

## Required smoke test

- 招待コードの正誤、12文字パスワード、ログイン、ログアウト。
- アルバム作成、QR SVG、設定変更、公開停止、合い言葉変更による旧cookie失効。
- JPEG/PNG/WebP原本とサムネイルのR2保存。SVG、偽MIME、20MB超を拒否。
- 合い言葉解除、写真一覧、個別原本、ZIP、共同投稿。
- 非認証・別album cookie・期限切れ・DL停止時の写真アクセス拒否。
- unlock 9回目の429、共同投稿rate limit、cross-origin owner writeの403。
- 写真削除、アルバム削除、アカウント削除後にR2 objectとD1 rowsが残らない。
- cronで期限切れalbumがR2/D1から削除される。
- モバイル、キーボード、スクリーンリーダーで主要導線を確認。

## Routine

- 毎日: Workers 5xx、R2/D1エラー、Turnstile失敗急増、削除cron結果、安全報告。
- 毎週: D1 exportの復元試験、R2 object数とD1 photo数の差分、依存監査、費用上限。
- 誤公開: 新規案件受付を止め、対象albumを停止。access secret流出ならローテーションし、全cookieを失効。
- 期限削除失敗: albumを非公開のまま再試行し、R2削除確認後にD1を削除。
- パイロット終了: 事前条件で判定し、継続しない場合は全写真を削除する。
