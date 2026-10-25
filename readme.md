# chatGPT-yunzai

[中文文档](./readme-zh.md)

A Yunzai-Bot (v3) chat plugin that forwards QQ messages to an OpenClaw Gateway and replies with the agent's answer. Each QQ user gets their own OpenClaw session. Requests go through a Redis-backed Bull queue, and an optional legacy ChatGPT path is kept for fallback.

## Features

- OpenClaw is the default provider. It can talk to the Gateway over WebSocket RPC (`connect` → `chat.send` → `chat.history`) or over REST (`/hooks/agent` + `/sessions` polling).
- Each QQ user gets a fixed session key, `yunzai:qq:<user_id>`, shared between group and private chats.
- Requests go through a Bull queue with configurable concurrency. Failed jobs are retried.
- The legacy OpenAI ChatGPT path (`gpt` / `/gpt`) is disabled by default.
- A basic block-word filter runs on replies. The list in `components/utils.js` is placeholder words only.
- Master-only status command and a per-user session reset command.

GPT-4 and Google Bard support have been removed.

## Requirements

- A running Yunzai-Bot v3 (Miao-Yunzai / TRSS-Yunzai) with Redis. Bull uses Redis on the default local port.
- A reachable OpenClaw Gateway and its token.
- Node.js 22 or newer if you use the WebSocket transport, because the plugin uses the global `WebSocket` and does not depend on the `ws` package. REST mode works on older Node versions.

## Installation

```bash
cd Yunzai-Bot/plugins
git clone https://github.com/Micuks/chatGPT-yunzai.git
cd chatGPT-yunzai
pnpm install
cp config/config.default.js config/config.js
```

`config/config.js` is required, because every module imports it, and it is git-ignored. The default template reads all settings from `process.env`.

## Configuration

Settings come from environment variables of the **Yunzai process**. `.env.example` lists every variable. The plugin does **not** load a `.env` file itself, so export the variables in the shell, systemd unit, pm2 config, or Docker environment that starts Yunzai. You can also hard-code values in your local `config/config.js`.

Minimal WebSocket setup:

```bash
OPENCLAW_ENABLED=true
OPENCLAW_BASE_URL=http://127.0.0.1:18789
OPENCLAW_TRANSPORT=ws
OPENCLAW_TOKEN=your_gateway_token
```

### Transport

| `OPENCLAW_TRANSPORT` | Behavior |
| --- | --- |
| `auto` (default) | Try REST first. Fall back to WebSocket only if REST fails with 404/405, `ENOTFOUND`, `ECONNREFUSED`, or `failed to fetch`. |
| `rest` | `POST {BASE_URL}{OPENCLAW_AGENT_HOOK_PATH}`, then poll `{BASE_URL}{OPENCLAW_SESSION_PATH}` until a new assistant message appears. |
| `ws` / `websocket` | Open a WebSocket for each question, run the `connect` handshake, send with `chat.send`, and poll `chat.history`. |

If the Gateway only exposes WebSocket, set `OPENCLAW_TRANSPORT=ws` explicitly. That avoids a wasted REST attempt on every message.

### Main variables

| Variable | Default | Description |
| --- | --- | --- |
| `OPENCLAW_ENABLED` | `true` | Master switch for the OpenClaw provider |
| `OPENCLAW_BASE_URL` | `http://127.0.0.1:18789` | Gateway base URL. The WebSocket URL is derived from it when `OPENCLAW_WS_URL` is empty |
| `OPENCLAW_TOKEN` | empty | Gateway token. Sent as `auth.token` in the WS `connect` call and as an HTTP auth header in REST mode |
| `OPENCLAW_AUTH_TYPE` | `bearer` | REST auth style: `bearer`, `header` (uses `OPENCLAW_AUTH_HEADER`), or `none` |
| `OPENCLAW_WS_URL` / `OPENCLAW_WS_PATHS` | empty / `/` | Explicit WS URL and extra candidate paths (comma-separated) |
| `OPENCLAW_WS_CLIENT_ID` / `_CLIENT_MODE` / `_ROLE` / `_SCOPES` | `gateway-client` / `backend` / `operator` / `operator.read,operator.write` | Values sent in the `connect` handshake |
| `OPENCLAW_PROTOCOL_VERSIONS` | `3,7` | Protocol versions tried in the handshake |
| `OPENCLAW_WS_SUBMIT_METHODS` / `_HISTORY_METHODS` / `_HEALTH_METHODS` | `chat.send` / `chat.history` / `health` | RPC method names (comma-separated, tried in order) |
| `OPENCLAW_WS_CONNECT_TIMEOUT_MS` / `_REQUEST_TIMEOUT_MS` | `5000` / `15000` | WS timeouts |
| `OPENCLAW_POLL_INTERVAL_MS` / `OPENCLAW_POLL_TIMEOUT_MS` | `1000` / `120000` | How often and how long to wait for the assistant reply |
| `OPENCLAW_DELIVER` | `false` | If `true`, ask OpenClaw to deliver the reply to another channel (`OPENCLAW_DELIVER_CHANNEL`, `OPENCLAW_DELIVER_TO`) and only send a "submitted" notice in QQ |
| `CONCURRENCY_JOBS` | `1` | Bull queue concurrency |
| `PROXY` | empty | HTTP(S) proxy for the legacy ChatGPT path only |

REST-only variables are `OPENCLAW_AGENT_HOOK_PATH`, `OPENCLAW_SESSION_PATH`, `OPENCLAW_SESSION_MODE` (`query`/`path`), `OPENCLAW_SESSION_QUERY_KEY`, `OPENCLAW_WAKE_MODE`, `OPENCLAW_SUBMIT_RETRIES`, and `OPENCLAW_RETRY_DELAY_MS`. See `.env.example` for all of them.

### Legacy ChatGPT (optional)

| Variable | Description |
| --- | --- |
| `LEGACY_CHATGPT_ENABLED` | Set to `true` to enable the `gpt` / `/gpt` commands |
| `OPENAI_API_KEY` | OpenAI API key (official mode) |
| `MODEL_NAME` | Model name, default `gpt-3.5-turbo` |
| `USE_UNOFFICIAL` / `API_ACCESS_TOKEN` / `API_REVERSE_PROXY_URL` | Use `ChatGPTUnofficialProxyAPI` with a ChatGPT access token. The default reverse-proxy URL points to a third-party service, so change it before enabling this mode |

## Commands

| Command | Description |
| --- | --- |
| `?question`, `？question`, `!question`, `！question`, `claw question`, `/claw question` | Ask OpenClaw |
| `gpt question`, `/gpt question` | Ask legacy ChatGPT (replies with a "disabled" notice unless `LEGACY_CHATGPT_ENABLED=true`) |
| `#重置openclaw会话`, `#清除claw会话` (also `…session`) | Reset the caller's local session record |
| `#openclaw状态`, `#openclawstatus` | Show the current OpenClaw config (master only, token not shown) |
| `#聊天帮助`, `#chathelp`, `#chatgpthelp`, `#chatmenu` | Help |
| `#聊天列表` | List users with session records (master only) |
| `#结束聊天`, `#停止对话` (optionally with @user) | Delete a session record |
| `#清除队列`, `#清空队列` | Clean active and waiting queue jobs |

A message with an empty question body (for example a bare `?`) is sent as the placeholder prompt `This is a blank prompt.`.

## Sessions and state

- Local metadata lives in Redis under `CHATGPT:META:<user_id>`: creation/update time, request counts, the OpenClaw session key, and the legacy ChatGPT conversation IDs.
- After 10 minutes of inactivity, or after `#重置openclaw会话`, the local metadata is recreated. **The OpenClaw session key stays `yunzai:qq:<user_id>`**, so the conversation history kept by the Gateway is not cleared. Reset it on the OpenClaw side if you need a clean context.

## Security

- Never commit `config/config.js`, `.env`, `OPENCLAW_TOKEN`, API keys, or access tokens. `config/config.js` and `.env` are already git-ignored.
- `#openclaw状态` is master-only and does not print the token.
- Quick check before pushing:

```bash
rg -n "OPENCLAW_TOKEN=.+|OPENAI_API_KEY=.+|API_ACCESS_TOKEN=.+|PRIVATE KEY|Bearer\s+\S+" -S . --glob '!node_modules'
```

## License

[MIT](./LICENSE.md)
