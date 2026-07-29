# 14DNA-ENGINE

**14の美学を、一つのエンジンへ。**

SNS専用の画像・Reels・Story・X縦／横動画・正方形動画を、14 Image DNA・14 Color DNA・14 Motion DNAで設計・生成するスマホファーストの無料ローカル生成基盤です。

## 実装済み

- PWA：iPhone / Android / PC
- GitHub Pages：`apps/mobile-pwa`を公開
- 9:16 / 16:9 / 1:1
- SVG / PNG無料画像生成
- Remotion無料動画生成
- FFmpeg H.264 MP4書き出し・検証・音声mux
- 日本語禁則処理、字幕速度、セーフエリアQA
- 日本語フォントファイルのchecksum・ライセンス検査・Sharp/Remotion埋込み
- PWAアイコン 192 / 512 / maskable 512の自動生成
- Tailscale HTTPSスマホ接続
- ComfyUI + FLUX.1 schnellローカル接続
- ComfyUI + LTX-Videoローカル接続
- Claude Code MCP
- Bearer Token / CORS / APIキー非公開
- 有料API自動フォールバックOFF

## 起動

```bash
npm install
cp .env.example .env
npm test
npm start
```

ローカル：`http://127.0.0.1:4314`

スマホ接続は`docs/TAILSCALE_HTTPS.md`を参照してください。

## フォント

正式なPNG・MP4出力では`private-fonts/`にライセンス確認済み日本語フォントとOFL等のライセンス文書を配置します。フォントがない場合、最終書き出しは`FONT_SETUP_REQUIRED`で停止します。フォントバイナリは公開GitHubへコミットしません。

## 無料生成モード

- `prompt_only`
- `template_svg`
- `template_png`
- `template_video`
- `flux_local`
- `ltx_video_local`

FLUXとLTXはローカルGPU性能・VRAM・導入モデルに依存します。14DNA-ENGINE自体は課金APIへ自動移行しません。

## 品質検査

CIで以下を実行します。

- JSON / PWA /秘密情報検査
- フォントバイナリ誤コミット防止
- 全SNS比率のSVG生成
- 日本語禁則処理
- 動画字幕・セーフエリアQA
- PWAアイコン3サイズ生成
- Remotionバンドル
- FFmpegで実MP4生成・再読込
- ComfyUIワークフロー構文検査
