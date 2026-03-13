# ChatGPT-Yunzai - ChatGPT Plugin for Yunzai-Bot(v3)

> A ChatGPT plugin for [Yunzai-Bot](https://gitee.com/yoimiya-kokomi/Yunzai-Bot)(v3) using OpenAI API. Supports GPT-3.5, GPT-4, and Google Bard.

## Features

| Feature | Command | Description |
|---------|---------|-------------|
| Ask ChatGPT | `?question` or `gpt question` | Single question |
| Continuous chat | `!question` | Chat with context |
| GPT-4 chat | `gpt4 question` or `/gpt4 question` | Use GPT-4 model (requires config) |
| Google Bard | `bard question` or `/bard question` | Chat with Bard (requires config) |
| Help | `#聊天帮助` | Show available commands |
| End chat | `#结束对话` | Clear conversation context |
| Clear queue | `#清除队列` | Clear waiting message queue |
| Chat stats | `#聊天列表` | View active chats (master only) |

## Highlights

- ✅ Continuous conversation with context
- ✅ Proxy support
- ✅ Official API and unofficial reverse proxy modes
- ✅ Sensitive word filtering
- ✅ Message queue management
- ✅ Auto retry (up to 5 times)

## Installation

### 1. Clone the plugin

```bash
cd Yunzai-Bot/plugins
git clone https://github.com/Micuks/chatGPT-yunzai.git
```

### 2. Install dependencies

```bash
cd chatGPT-yunzai
pnpm install
```

### 3. Configure

```bash
cd config
cp config.default.js config.js
```

Edit `config.js`:

```javascript
// OpenAI API Key (required for official mode)
const API_KEY = "sk-xxx";

// Proxy (optional)
const PROXY = "http://127.0.0.1:7890";

// Enable GPT-4 (requires ChatGPT Plus subscription)
const USE_GPT4 = true;

// Enable Google Bard
const USE_BARD = false;
const BARD_COOKIE = "__Secure-1PSID=xxx";
```

### 4. Start

```bash
cd Yunzai-Bot
npm run start
```

## Configuration

| Option | Description | Default |
|--------|-------------|---------|
| `API_KEY` | OpenAI API key | empty |
| `PROXY` | Proxy URL | empty |
| `MODEL_NAME` | Model name | `gpt-3.5-turbo-0301` |
| `USE_GPT4` | Enable GPT-4 | `false` |
| `USE_BARD` | Enable Bard | `false` |
| `BARD_COOKIE` | Bard Cookie | empty |
| `USE_UNOFFICIAL` | Use unofficial mode | `false` |
| `API_ACCESS_TOKEN` | Access token for unofficial mode | empty |
| `CONCURRENCY_JOBS` | Concurrent jobs | 1 |

## Modes

### Official Mode (Recommended)

Use OpenAI official API, stable and reliable:

```javascript
const API_KEY = "sk-your-api-key";
const USE_UNOFFICIAL = false;
```

### Unofficial Mode

Use reverse proxy, free but rate-limited:

```javascript
const USE_UNOFFICIAL = true;
const API_ACCESS_TOKEN = "your-access-token";
```

Get Access Token: Visit https://chat.openai.com/api/auth/session

## Notes

1. Official mode requires OpenAI API credits
2. Unofficial mode may be unstable and has security risks
3. Google Bard has strict cookie detection, experience may vary
4. Conversations auto-reset after 10 minutes of inactivity

## License

MIT