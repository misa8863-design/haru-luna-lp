# haru luna LP（月夜から、夜明けへ。）

haru luna のブランドLPです。ビルド不要の静的サイトなので、GitHubにアップロードしてそのままVercelで公開できます。

## ファイル構成

- `index.html` … ページ本体
- `style.css` … デザイン
- `main.js` … 動き（開幕演出・星空・夜明けのPV・灯り など）
- `assets/` … 画像・動画・アイコン
- `vercel.json` / `site.webmanifest` / `robots.txt` / `favicon.ico`
- `DIRECTION.md` … デザインの設計図（公開には不要ですが、修正時の参考用）

## Vercelでの公開手順

1. GitHubで新しいリポジトリを作り、このフォルダの中身をすべてアップロード
2. Vercelで「Add New → Project」から、そのリポジトリを選ぶ
3. Framework Preset は「Other」のまま、Build Command・Output Directory は空欄で「Deploy」

## 公開後に差し替えるもの

- 公式LINEのURL：`index.html` 内の `https://line.me/`（2か所）
- OGP画像を絶対URLにする場合：`og:image` を `https://（公開URL）/assets/og-logo.png` に変更
