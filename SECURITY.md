# Security Policy

## Reporting

脆弱性や写真の誤公開を公開Issueへ投稿しないでください。[Private vulnerability report](https://github.com/yhay81/album-relay/security/advisories/new)を使い、パイロット参加時には濫用・削除用の非公開連絡経路も案内します。24時間以内に一次確認します。

## Implemented baseline

- 所有者はBetter Auth、12文字以上のパスワード、30日session。公開登録はTurnstileと3回/分のrate limitを通し、D1 triggerで10名に制限する。
- 合い言葉はランダムsalt付きscrypt（N=16,384、r=16、p=1、64-byte key）。平文を保存しない。
- 閲覧権限はalbum ID・access version・viewer ID・期限を含むHMAC署名付きHttpOnly/SameSite cookie。
- 合い言葉変更、公開停止、期限切れ、削除で既存accessを拒否。
- 本番unlockはTurnstile必須、IPをアプリDBへ保存せず8回/分をCloudflare側で制限。
- 写真はJPEG/PNG/WebPのmagic bytes、20MB、2,000枚、寸法範囲を検査。
- 原本とサムネイルは非公開R2。R2 keyを公開せず、Worker経由だけで返す。
- CSP、HSTS、クリックジャッキング・MIME sniffing防止、同一オリジン検査、25MB body limit。
- 一括ZIPはR2 streamを逐次読み、全写真をWorker memoryへ保持しない。
- 秘密値をGitへ保存しない。CIでformat、lint、型、unit test、production buildを実行。

## Pilot limitations

- 写真内容のウイルス・違法性・撮影同意を自動判定しない。
- 画像のクライアントサイド暗号化は未実装。Cloudflareアカウント侵害時の防御境界はR2/D1の権限管理に依存する。
- メール確認とパスワード再設定メールは未実装。招待制期間は本人確認後に個別対応する。
- 販売、プリント、返金、配送を扱わない。
