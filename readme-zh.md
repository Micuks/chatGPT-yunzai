# chatGPT-yunzai

[English](./readme.md)

运行在 Yunzai-Bot（v3）上的聊天插件：把 QQ 消息转发给 OpenClaw Gateway，再把 agent 的回复发回 QQ。每个 QQ 用户有独立的 OpenClaw 会话，请求经过基于 Redis 的 Bull 队列，同时保留可选的旧版 ChatGPT 通道作为回退。

## 功能

- 默认 provider 为 OpenClaw，支持两种接入方式：WebSocket RPC（`connect` → `chat.send` → `chat.history`）和 REST（`/hooks/agent` + 轮询 `/sessions`）。
- 每个 QQ 用户固定使用会话 key `yunzai:qq:<user_id>`，群聊和私聊共用。
- Bull 队列，并发数可配置，失败任务自动重试。
- 旧版 OpenAI ChatGPT 通道（`gpt` / `/gpt`）默认关闭。
- 回复前做基础屏蔽词过滤。`components/utils.js` 里的词表只是占位词。
- 提供主人专用的状态查询，以及按用户重置会话的指令。

GPT-4 和 Google Bard 已移除。

## 环境要求

- 已运行的 Yunzai-Bot v3（Miao-Yunzai / TRSS-Yunzai）及 Redis。Bull 默认连接本机 Redis。
- 可访问的 OpenClaw Gateway 及其 token。
- 使用 WebSocket 方式时需要 Node.js 22 及以上：插件用的是全局 `WebSocket`，没有依赖 `ws` 包。REST 方式没有这个限制。

## 安装

```bash
cd Yunzai-Bot/plugins
git clone https://github.com/Micuks/chatGPT-yunzai.git
cd chatGPT-yunzai
pnpm install
cp config/config.default.js config/config.js
```

`config/config.js` 必须存在：所有模块都会 import 它，而它已被 git 忽略。默认模板从 `process.env` 读取全部配置。

## 配置

配置来自 **Yunzai 进程**的环境变量，`.env.example` 列出了全部变量。插件**不会**自己加载 `.env` 文件，所以请在启动 Yunzai 的 shell、systemd、pm2 或 Docker 环境中设置这些变量，也可以直接写进本地的 `config/config.js`。

最小 WebSocket 配置：

```bash
OPENCLAW_ENABLED=true
OPENCLAW_BASE_URL=http://127.0.0.1:18789
OPENCLAW_TRANSPORT=ws
OPENCLAW_TOKEN=your_gateway_token
```

### 传输方式

| `OPENCLAW_TRANSPORT` | 行为 |
| --- | --- |
| `auto`（默认） | 先试 REST。只有 REST 报 404/405、`ENOTFOUND`、`ECONNREFUSED` 或 `failed to fetch` 时，才回退到 WebSocket。 |
| `rest` | `POST {BASE_URL}{OPENCLAW_AGENT_HOOK_PATH}`，然后轮询 `{BASE_URL}{OPENCLAW_SESSION_PATH}`，直到出现新的 assistant 消息。 |
| `ws` / `websocket` | 每个问题新建一条 WebSocket 连接，完成 `connect` 握手，用 `chat.send` 发送，再轮询 `chat.history`。 |

如果 Gateway 只提供 WebSocket，请显式设置 `OPENCLAW_TRANSPORT=ws`，避免每条消息都白白先试一次 REST。

### 主要变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `OPENCLAW_ENABLED` | `true` | OpenClaw provider 总开关 |
| `OPENCLAW_BASE_URL` | `http://127.0.0.1:18789` | Gateway 地址。`OPENCLAW_WS_URL` 为空时，WS 地址由它推导 |
| `OPENCLAW_TOKEN` | 空 | Gateway token。WS 模式下作为 `connect` 的 `auth.token` 发送，REST 模式下作为 HTTP 鉴权头发送 |
| `OPENCLAW_AUTH_TYPE` | `bearer` | REST 鉴权方式：`bearer`、`header`（使用 `OPENCLAW_AUTH_HEADER`）或 `none` |
| `OPENCLAW_WS_URL` / `OPENCLAW_WS_PATHS` | 空 / `/` | 显式 WS 地址，以及额外的候选路径（逗号分隔） |
| `OPENCLAW_WS_CLIENT_ID` / `_CLIENT_MODE` / `_ROLE` / `_SCOPES` | `gateway-client` / `backend` / `operator` / `operator.read,operator.write` | `connect` 握手中发送的字段 |
| `OPENCLAW_PROTOCOL_VERSIONS` | `3,7` | 握手时依次尝试的协议版本 |
| `OPENCLAW_WS_SUBMIT_METHODS` / `_HISTORY_METHODS` / `_HEALTH_METHODS` | `chat.send` / `chat.history` / `health` | RPC 方法名（逗号分隔，按顺序尝试） |
| `OPENCLAW_WS_CONNECT_TIMEOUT_MS` / `_REQUEST_TIMEOUT_MS` | `5000` / `15000` | WS 超时 |
| `OPENCLAW_POLL_INTERVAL_MS` / `OPENCLAW_POLL_TIMEOUT_MS` | `1000` / `120000` | 等待 assistant 回复的轮询间隔和总超时 |
| `OPENCLAW_DELIVER` | `false` | 为 `true` 时，让 OpenClaw 把回复投递到其他渠道（`OPENCLAW_DELIVER_CHANNEL`、`OPENCLAW_DELIVER_TO`），QQ 里只发一条“已提交”提示 |
| `CONCURRENCY_JOBS` | `1` | Bull 队列并发数 |
| `PROXY` | 空 | HTTP(S) 代理，只用于旧版 ChatGPT 通道 |

只在 REST 模式下生效的变量有 `OPENCLAW_AGENT_HOOK_PATH`、`OPENCLAW_SESSION_PATH`、`OPENCLAW_SESSION_MODE`（`query`/`path`）、`OPENCLAW_SESSION_QUERY_KEY`、`OPENCLAW_WAKE_MODE`、`OPENCLAW_SUBMIT_RETRIES`、`OPENCLAW_RETRY_DELAY_MS`，完整列表见 `.env.example`。

### 旧版 ChatGPT（可选）

| 变量 | 说明 |
| --- | --- |
| `LEGACY_CHATGPT_ENABLED` | 设为 `true` 才启用 `gpt` / `/gpt` |
| `OPENAI_API_KEY` | OpenAI API key（官方模式） |
| `MODEL_NAME` | 模型名，默认 `gpt-3.5-turbo` |
| `USE_UNOFFICIAL` / `API_ACCESS_TOKEN` / `API_REVERSE_PROXY_URL` | 使用 `ChatGPTUnofficialProxyAPI` 和 ChatGPT access token。默认反代地址是第三方服务，启用前请先改掉 |

## 指令

| 指令 | 说明 |
| --- | --- |
| `?问题`、`？问题`、`!问题`、`！问题`、`claw 问题`、`/claw 问题` | 向 OpenClaw 提问 |
| `gpt 问题`、`/gpt 问题` | 向旧版 ChatGPT 提问（未设置 `LEGACY_CHATGPT_ENABLED=true` 时只会回复“已关闭”） |
| `#重置openclaw会话`、`#清除claw会话`（也可用 `…session`） | 为自己开启一个新的 OpenClaw 会话 |
| `#openclaw状态`、`#openclawstatus` | 查看当前 OpenClaw 配置（仅主人，不显示 token） |
| `#聊天帮助`、`#chathelp`、`#chatgpthelp`、`#chatmenu` | 帮助 |
| `#聊天列表` | 列出有会话记录的用户（仅主人） |
| `#结束聊天`、`#停止对话`（@ 别人仅限主人） | 删除会话记录 |
| `#清除队列`、`#清空队列` | 清理执行中和等待中的队列任务 |

问题内容为空时（比如只发一个 `?`），会发送占位提示 `This is a blank prompt.`。

## 会话与状态

- 本地元数据存放在 Redis 的 `CHATGPT:META:<user_id>` 下，包括创建/更新时间、请求次数、OpenClaw 会话 key 和旧版 ChatGPT 的会话 ID。
- 当前使用的 OpenClaw 会话 key 单独存放在 `CHATGPT:OPENCLAW_SESSION:<user_id>`，初始值为 `yunzai:qq:<user_id>`。
- 执行 `#重置openclaw会话` 后会换成新 key `yunzai:qq:<user_id>:<时间戳>`，下一次提问从空的 Gateway 上下文开始。旧的历史仍然留在 Gateway 上。
- 10 分钟无交互只会重建本地元数据（计数、时间戳），OpenClaw 会话 key 及其 Gateway 历史都会保留。`#结束聊天` 同样只删除本地元数据。
- 如果 OpenClaw 已经收到消息却没有返回回复（轮询超时、Gateway 报错、WS 请求超时），这个任务不会重试，避免 agent 把同一条消息执行两遍，同时会提示用户稍后再问。

## 安全

- 不要提交 `config/config.js`、`.env`、`OPENCLAW_TOKEN`、API key 或 access token。`config/config.js` 和 `.env` 已在 `.gitignore` 中。
- `#openclaw状态` 仅主人可用，且不会输出 token。
- Gateway 不在本机时请使用 `https://` / `wss://`。走 `http://` 或 `ws://` 时 token 会以明文发送，插件启动时会打印警告。
- 推送前可以快速检查一遍：

```bash
rg -n "OPENCLAW_TOKEN=.+|OPENAI_API_KEY=.+|API_ACCESS_TOKEN=.+|PRIVATE KEY|Bearer\s+\S+" -S . --glob '!node_modules'
```

## 许可证

[MIT](./LICENSE.md)
