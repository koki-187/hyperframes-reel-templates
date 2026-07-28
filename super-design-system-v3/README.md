# MAW HYPERFRAME — SUPER DESIGN SYSTEM v3

画像・Reels・Story・X縦／横動画・正方形動画を、14のImage DNA、14のColor DNA、14のMotion DNAで設計するローカル生成ハブです。

## 主な機能
- 9:16 / 16:9 / 1:1
- 3〜60秒のDesign Recipe（実際の生成上限は接続モデル依存）
- 1〜4本のバリエーション設計
- 14 Motion DNA / 14 Color DNA / Seed固定
- Storyboard / camera / animation / prompt export
- GitHub Pages用コントロールパネル
- Windows/macOSデスクトップワンタッチ起動
- Claude Code MCP接続
- OpenAI / Replicate / fal / custom webhookのadapter枠

## 起動
```bash
npm install
npm test
npm start
```
`http://127.0.0.1:4314`

## 重要な制限
本パッケージ単体は、APIキーなしで外部モデルへ動画をレンダリングしません。Prompt/Storyboard Exportは即時利用可能です。秒数・解像度・本数は接続する動画モデル、契約プラン、クレジットに依存し、不明値は`VERIFY_IN_ACCOUNT`として扱います。

GitHub Pagesは静的サイトです。APIキーをPagesへ置かず、実生成はローカルアプリまたは安全なバックエンドから行ってください。

## 名称候補
1. MAW HYPERFRAME（推奨）
2. KINETIC ATLAS
3. SIGNAL/14
4. VANTA MOTION OS
5. FRAMEFORGE DNA
