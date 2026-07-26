# Decisions

## 2026-07-26: replacement boundary

- 30days Album等の全機能複製ではなく、次の実案件でQR配布から閲覧・原本受取・共同投稿まで完了する範囲を置き換える。
- 販売・プリントは支払意思が確認される前に顧客資金と配送責任を持たないため、初回検証から外す。
- 過去アルバムの完全移行は作らず、新規案件単位で切り替える。

## 2026-07-26: storage and access

- 構造化データはD1、原本とサムネイルは非公開R2。
- Cloudflare Imagesへの依存を避け、サムネイルはブラウザで生成して原本と一緒に保存する。
- 受取側は登録不要。合い言葉解除後の署名付きHttpOnly cookieで最長12時間アクセスする。
- 合い言葉変更時はaccess versionを増やし、既存cookieを即時失効させる。
- 合い言葉はBetter Authと同じWorkers互換のscrypt実装を使う。Cloudflare Web CryptoのPBKDF2上限へ合わせて反復回数を弱めない。
- 一括DLは`client-zip`でR2から逐次streamし、2,000枚をmemoryへ集約しない。

## 2026-07-26: measurement

- IPや氏名を保存せず、access tokenのランダムviewer IDをHMAC匿名化して完了ブラウザ数を数える。
- Cookie削除や別ブラウザによる重複を明記し、厳密な人物追跡よりプライバシーを優先する。
