# Tailscale HTTPS接続

## 目的
GitHub PagesのPWAから、自宅または事務所PCのRender NodeへHTTPSで安全に接続する。

## 前提
- PCとスマホを同じTailscaleアカウントへ登録
- MagicDNSとHTTPSを有効化
- `.env`に32byte以上の`DNA_RENDER_TOKEN`を設定
- `DNA_ALLOWED_ORIGINS`へGitHub PagesのOriginを設定

## macOS
`desktop/START_14DNA_TAILSCALE.command`を実行する。

## Windows
PowerShellで`desktop/START_14DNA_TAILSCALE.ps1`を実行する。

## PWA設定
表示された`https://<device>.<tailnet>.ts.net`と`DNA_RENDER_TOKEN`をスマホPWAの接続設定へ入力する。

## セキュリティ
- Render Nodeは127.0.0.1で待受し、Tailscale ServeだけがHTTPS公開する。
- APIトークンをGitHub Pages、URL、ログ、生成物へ含めない。
- Tailnet外からのアクセスは許可しない。
- 紛失端末がある場合はTailscale管理画面で端末を無効化し、トークンを再発行する。

## 停止
`tailscale serve reset`で公開設定を解除する。
