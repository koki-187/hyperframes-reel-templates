# HyperFrames SNS会話リール テンプレート集

**HTMLを書くと動画になる。** [HyperFrames](https://github.com/heygen-com/hyperframes)（HeyGen製OSS・無料）で、LINE風／X風／Instagram DM風の「会話リール」（1080×1920・30秒）を生成するための実働テンプレートです。

実際にSNS運用で使っている本番テンプレをそのまま公開しています（題材例：宅建学習アプリ [宅建BOOST](https://takken-boost.jp)）。会話テキストとブランド部分を差し替えるだけで、自分のプロダクト用リールが作れます。

| テンプレート | 演出 |
|---|---|
| `templates/line-chat.html` | LINE風トーク（既読・タイピング・リンクカード・タップ→アプリ起動CTA） |
| `templates/x-thread.html` | X(Twitter)風スレッド（返信先・スレッド線・SVGアクションアイコン・♡点灯） |
| `templates/instagram-dm.html` | Instagram DM風（ストーリーリング・青吹き出し・シェアカード） |

## 使い方

```bash
# 1. HyperFramesプロジェクトを作成（Node 22+ / FFmpeg必須）
npx hyperframes init myreel
cd myreel

# 2. テンプレートを index.html として配置（rootコンポジションは1つだけ）
cp ../templates/line-chat.html index.html

# 3. 検査 → レンダリング
npx hyperframes check .
npx hyperframes render .   # renders/*.mp4 が出力される
```

会話の中身は `index.html` 内の `.bub`（吹き出し）テキストを書き換えるだけ。登場タイミングは `<script>` 内のGSAPタイムライン（ビート秒）で調整します。

## 音入れ（SFX/BGMもFFmpegで無料合成）

```bash
cd audio
bash make_sfx.sh                     # ポップ音・遷移音・BGMパッドをサイン波合成（権利フリー）
bash mux_line.sh <入力.mp4> <出力.mp4>  # ビートマップ通りに焼き込み
```

## ハマりどころ（先に知っておくと事故らない）

- **GSAPの `repeat: -1` は禁止**。決定論レンダラーがシークできなくなるため、`repeat: Math.floor(総尺/周期) - 1` の有限回数にする。
- **日本語フォントは `@font-face` + `local()`** を宣言する（`font_family_without_font_face` 検査対策）。
- **コントラスト検査（WCAG 3:1）**：LINE緑 `#06C755` に白文字は落ちる → `#0a8f45` 程度に暗くする。
- **音声の `alimiter` は `level=0` を明示**（既定のauto-levelが出力を0dBへ持ち上げる）。
- タップ演出のripple座標は**スクロール後のカード実位置**に合わせる。

## ライセンス

MIT License. テンプレート内のブランド表記（宅建BOOST）はサンプルです。ご自身のブランドに差し替えてお使いください。
