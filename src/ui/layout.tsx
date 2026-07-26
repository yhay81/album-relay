import type { Child } from "hono/jsx";

import { product } from "../config/product";

type LayoutProps = {
  children: Child;
  description?: string;
  scripts?: string[];
  title?: string;
};

export function Layout({
  children,
  description = product.description,
  scripts = [],
  title = product.name,
}: LayoutProps) {
  return (
    <html lang="ja">
      <head>
        <meta charset="utf-8" />
        <meta content="width=device-width, initial-scale=1" name="viewport" />
        <meta content={description} name="description" />
        <link href="/styles.css" rel="stylesheet" />
        <title>{title}</title>
        {scripts.map((source) => (
          <script async defer src={source}></script>
        ))}
      </head>
      <body>
        <a class="skip-link" href="#main">
          本文へ移動
        </a>
        <header class="site-header">
          <a class="brand" href="/">
            {product.name}
          </a>
          <nav aria-label="メイン">
            <a href="/login">ログイン</a>
            <a class="nav-cta" href="/signup">
              アルバムを作る
            </a>
          </nav>
        </header>
        <main id="main">{children}</main>
        <footer>
          <span>{product.name}</span>
          <nav aria-label="フッター">
            <a href="/privacy">プライバシー</a>
            <a href="/login">ログイン</a>
            <a href="/healthz">稼働状態</a>
          </nav>
        </footer>
      </body>
    </html>
  );
}
