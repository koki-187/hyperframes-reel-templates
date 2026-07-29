# Setup

## Local app

```bash
cd super-design-system-v3
npm install
npm start
```

Open `http://127.0.0.1:4314`.

## Claude Code MCP

macOS / Linux / WSL:

```bash
claude mcp add --scope user maw-hyperframe -- node /ABSOLUTE/PATH/super-design-system-v3/mcp-server/index.mjs
claude mcp list
```

Windows native Claude Code:

```powershell
claude mcp add --scope user maw-hyperframe -- cmd /c node C:\ABSOLUTE\PATH\super-design-system-v3\mcp-server\index.mjs
```

Available tools:

- `create_design_recipe`
- `list_motion_dna`
- `list_social_formats`

Example request:

> maw-hyperframeを使い、My Agent Followの新機能告知を10秒のReels向けに設計。SeedはMAF-001。ストーリーボードと生成プロンプトを出力。

## Security boundary

GitHub Pages is static and must not hold provider API keys. The Pages app prepares recipes. Actual rendering runs through the localhost gateway or a protected webhook. Store keys only in a local `.env` that is excluded from Git.

## Provider limitations

The system supports 3–60 second recipes and 1–4 variants. Actual duration, resolution, batch count, credits, watermarks and commercial-use conditions depend on the selected provider/model. Unknown values must be displayed as `VERIFY_IN_ACCOUNT`.
