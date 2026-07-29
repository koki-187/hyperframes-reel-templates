# 14DNA-ENGINE 実装ロードマップ

進捗の正本は GitHub Issue #2 とする。

## 現在の実装フェーズ

### 実装中
- スマホファーストPWA
- 日本語フォントレジストリ
- オフライン下書き
- Web Share / Share Target
- Render Job API仕様
- CI検証

### 次工程
- HTML/SVG静止画レンダラー
- Remotion短尺動画レンダラー
- ComfyUI / FLUX.1 schnellアダプター
- LTX-Videoアダプター
- Claude Code MCPのジョブ操作ツール

## 設計原則
1. スマホを主操作画面とする。
2. PCは高解像度レンダリングとローカルAI処理だけを担当する。
3. APIキーと正式フォントはGitHub Pagesへ置かない。
4. 課金APIへの自動フォールバックは無効にする。
5. 生成プロンプトにデザイナー名・作品名を含めない。
6. 画像・動画・カラーは同一Seedの14DNAで連動する。
7. 最終出力は日本語フォントとSNSセーフエリアを検査する。
