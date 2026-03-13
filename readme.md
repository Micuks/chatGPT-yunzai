# chatGPT-yunzai (OpenClaw Edition)

A Yunzai-Bot chat plugin that now uses **OpenClaw Gateway** as the default provider, with session memory, queue-based processing, and optional legacy ChatGPT fallback.

## Features

- OpenClaw-first architecture (WebSocket preferred)
- Unified `Response` return shape
- Per-user isolated sessions: `yunzai:qq:<user_id>`
- Optional legacy ChatGPT fallback (disabled by default)

## Installation

```bash
cd Yunzai-Bot/plugins
git clone https://github.com/Micuks/chatGPT-yunzai.git
cd chatGPT-yunzai
pnpm i
```

## Commands

- `?question` / `？question` / `!question` / `！question` / `claw question` / `/claw question`: OpenClaw
- `gpt question` / `/gpt question`: legacy ChatGPT (must be enabled explicitly)
- `#openclaw状态`: show OpenClaw runtime config
- `#重置openclaw会话` / `#清除claw会话`: reset current user's session

## Configuration

Copy `.env.example` and set environment variables.

Minimal OpenClaw setup:

```bash
OPENCLAW_ENABLED=true
OPENCLAW_BASE_URL=http://127.0.0.1:18789
OPENCLAW_TRANSPORT=ws
OPENCLAW_WS_URL=ws://127.0.0.1:18789
OPENCLAW_TOKEN=your_token
```

Common gateway settings:

```bash
OPENCLAW_WS_CONNECT_METHODS=connect
OPENCLAW_WS_CLIENT_ID=gateway-client
OPENCLAW_WS_CLIENT_MODE=backend
OPENCLAW_WS_ROLE=operator
OPENCLAW_WS_SCOPES=operator.read,operator.write
OPENCLAW_WS_SUBMIT_METHODS=chat.send
OPENCLAW_WS_HISTORY_METHODS=chat.history
OPENCLAW_WS_HEALTH_METHODS=health
```

## Security Notes

- Never commit `OPENCLAW_TOKEN`, API keys, or cookies.
- Keep secrets in environment variables or private `.env`.
- Run a quick scan before pushing:

```bash
rg -n "OPENCLAW_TOKEN|API_KEY|password|PRIVATE KEY|Bearer\\s+" -S .
```

## Compatibility Notes

- Legacy GPT-4/Bard command paths are removed.
- REST polling remains as fallback, but Gateway WebSocket is recommended.
