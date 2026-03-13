# chatGPT-yunzai（OpenClaw 版）

面向 Yunzai-Bot 的对话插件，当前以 **OpenClaw Gateway** 为默认通道，支持会话记忆、队列串行处理与可选的 legacy ChatGPT 回退。

## 特性

- 默认走 OpenClaw（WebSocket 优先）
- 统一 `Response` 返回结构
- 按用户隔离会话：`yunzai:qq:<user_id>`
- 可选 legacy ChatGPT 回退（默认关闭）

## 安装

```bash
cd Yunzai-Bot/plugins
git clone https://github.com/Micuks/chatGPT-yunzai.git
cd chatGPT-yunzai
pnpm i
```

## 指令

- `?问题` / `？问题` / `!问题` / `！问题` / `claw 问题` / `/claw 问题`：走 OpenClaw
- `gpt 问题` / `/gpt 问题`：走 legacy ChatGPT（需要显式开启）
- `#openclaw状态`：查看 OpenClaw 运行配置
- `#重置openclaw会话` / `#清除claw会话`：重置当前用户会话

## 配置

推荐复制 `.env.example` 并按需设置环境变量。

最小可用配置（OpenClaw）：

```bash
OPENCLAW_ENABLED=true
OPENCLAW_BASE_URL=http://127.0.0.1:18789
OPENCLAW_TRANSPORT=ws
OPENCLAW_WS_URL=ws://127.0.0.1:18789
OPENCLAW_TOKEN=your_token
```

Gateway 常用配置：

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

## 安全建议

- 不要将 `OPENCLAW_TOKEN`、API 密钥、Cookie 提交到仓库。
- 推荐把敏感项注入到系统环境变量或私有 `.env`。
- 提交前执行：

```bash
rg -n "OPENCLAW_TOKEN|API_KEY|password|PRIVATE KEY|Bearer\\s+" -S .
```

## 兼容性说明

- 旧版 GPT-4/Bard 指令路径已移除。
- 旧版 REST 轮询可作为回退模式，但推荐使用 Gateway WebSocket。
