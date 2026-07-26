# Metrics

## Product records

`album_visitors`は、access cookie内のランダムIDをHMACで匿名化した値だけを保持します。IP、氏名、メール、合い言葉、写真情報とは結合しません。

| Field                 | Meaning                          | Personal data |
| --------------------- | -------------------------------- | ------------- |
| `unlocked_at`         | 正しい合い言葉で解除したブラウザ | Pseudonymous  |
| `first_viewed_at`     | 写真一覧を一度以上表示           | Pseudonymous  |
| `first_downloaded_at` | 原本またはZIPを一度以上保存      | Pseudonymous  |

Cookie削除や別ブラウザ利用は別人数として数えられるため、これは厳密な人物数ではなく完了ブラウザ数です。実験では撮影者が入力した招待人数を分母にし、重複可能性を結果へ明記します。

## Ratios

- Unlock completion: `unlocked / expected_viewers`
- View completion: `viewed / expected_viewers`
- Download completion: `downloaded / expected_viewers`
- Photographer activation: 実案件で写真を追加しQRを配布した撮影者 / 招待撮影者
- Replacement: 既存サービスを併用せず案件を完了した撮影者 / 招待撮影者
- Paid intent: 月3,000円以上で継続意向 / 招待撮影者

集計の分母、招待人数の自己申告、Cookie重複、欠測、期限前削除を結果と一緒に公開します。写真、ファイル名、個別案件名は公開しません。
