# GitHub Pages公開手順

## 初回のみ必要

GitHub PagesはリポジトリへWorkflowを追加しただけでは公開されません。リポジトリ管理者が初回だけ公開元を有効化します。

1. `Settings` を開く
2. 左側の `Pages` を開く
3. `Build and deployment` の `Source` を `GitHub Actions` に変更
4. `Actions` を開く
5. `Deploy 14DNA-ENGINE Mobile PWA` を選択
6. `Run workflow` → `main` → `Run workflow`

## 公開URL

`https://koki-187.github.io/hyperframes-reel-templates/`

## 正常性確認

- トップ画面に `14DNA-ENGINE` が表示される
- `/advanced.html` が開く
- `/manifest.webmanifest` がJSONで表示される
- `/deployed-commit.txt` に公開コミットSHAが表示される
- ブラウザからホーム画面追加が可能

## 404になる場合

GitHub標準の「There isn't a GitHub Pages site here.」が表示される場合は、Pagesサイトが未有効です。`Settings > Pages > Source > GitHub Actions`を選択してください。

Workflowは、PWAアイコン生成、公開対象検査、Artifact作成、Pagesデプロイ、公開URL出力を自動実行します。
