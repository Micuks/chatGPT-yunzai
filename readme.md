# chatGPT-yunzai

Yunzai-Bot(v3) plugin for ChatGPT-style conversations.

The current codebase supports:

- OpenAI access through the official `ChatGPTAPI` flow or the unofficial reverse-proxy flow
- Optional GPT-4 requests through `gpt4` or `/gpt4`
- Optional Google Bard requests through `bard` or `/bard`
- Per-user conversation state stored in Redis and reset after 10 minutes of inactivity
- Bull-based request queue with configurable concurrency
- Automatic retries on failed jobs
- Simple block-word filtering before sending the final reply
- Queue cleanup and help commands

Chinese documentation: [readme-zh.md](./readme-zh.md)

## Install

1. Clone this repository into your Yunzai-Bot `plugins/` directory.

```bash
cd Yunzai-Bot/plugins
git clone https://github.com/Micuks/chatGPT-yunzai.git
```

2. Copy the config template.

```bash
cd chatGPT-yunzai/config
cp config.default.js config.js
```

3. Install dependencies.

```bash
cd ../
pnpm install
```

4. Fill `config/config.js` according to the mode you want to use.

## Configuration

The following options are used by the current runtime:

| Key | Current behavior |
| --- | --- |
| `PROXY` | Optional HTTP(S) proxy used by both ChatGPT and Bard clients |
| `API_KEY` | Required for the official OpenAI mode |
| `USE_UNOFFICIAL` | Switches ChatGPT calls to `ChatGPTUnofficialProxyAPI` |
| `API_ACCESS_TOKEN` | Required when `USE_UNOFFICIAL=true` |
| `API_REVERSE_PROXY_URL` | Optional reverse-proxy endpoint for unofficial mode |
| `USE_GPT4` | Enables the `gpt4` and `/gpt4` commands |
| `USE_BARD` | Enables the `bard` and `/bard` commands |
| `BARD_COOKIE` | Required when `USE_BARD=true` |
| `CONCURRENCY_JOBS` | Controls Bull queue concurrency |

Notes about legacy config entries in the template:

- `MODEL_NAME` is still present in `config.default.js`, but the current runtime does not use it for model selection.
- `MODEL_PAID` is exported, but the current runtime does not read it.
- Current built-in fallback models are `gpt-3.5-turbo-1106` for ChatGPT and `gpt-4-0613` for GPT-4.

## Commands

The current code recognizes these user-facing commands:

| Feature | Command |
| --- | --- |
| Chat with ChatGPT | `?question`, `？question`, `!question`, `！question`, `gpt question`, `/gpt question` |
| Chat with GPT-4 | `gpt4 question`, `/gpt4 question` |
| Chat with Bard | `bard question`, `/bard question` |
| Help | `#聊天帮助`, `#chatgpthelp`, `#chathelp`, `#chatmenu` |
| Clear queue | `#清除队列`, `#清空队列` |

Behavior notes:

- All chat prefixes use the same per-user session mechanism. `!` is not a separate "continuous chat" mode.
- Chat sessions are refreshed after 10 minutes of inactivity.
- When a request is queued, the plugin sends a short `Thinking...` message with waiting and active job counts.

## Known Limits From Current Code

- `#聊天列表` and `#结束` or `#停止` chat handlers still exist in the code, but they read legacy `CHATGPT:CHATS:*` keys while active conversation state is stored under `CHATGPT:META:*`. They are not documented here as reliable supported features.
- The block-word filter uses the placeholder list in `components/utils.js`. You should treat it as a basic built-in safeguard, not a complete moderation system.
- Bard support is still implemented as Google Bard, matching the current code and dependency names.
