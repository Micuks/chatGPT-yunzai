# ChatGPT-Yunzai - Yunzai-Bot(v3) ChatGPT 插件

> 基于 OpenAI API 的 [Yunzai-Bot](https://gitee.com/yoimiya-kokomi/Yunzai-Bot)(v3) ChatGPT 插件，支持 GPT-3.5、GPT-4 和 Google Bard。

## 功能

| 功能 | 指令 | 说明 |
|------|------|------|
| 询问 ChatGPT | `?问题` 或 `gpt 问题` | 单次提问 |
| 连续对话 | `!问题` | 保持上下文的连续对话 |
| GPT-4 对话 | `gpt4 问题` 或 `/gpt4 问题` | 使用 GPT-4 模型（需配置启用） |
| Google Bard | `bard 问题` 或 `/bard 问题` | 与 Bard 对话（需配置启用） |
| 查看帮助 | `#聊天帮助` | 显示可用命令 |
| 结束对话 | `#结束对话` | 清除当前对话上下文 |
| 清空队列 | `#清除队列` | 清空等待中的消息队列 |
| 聊天统计 | `#聊天列表` | 查看当前活跃的对话（仅主人） |

## 特性

- ✅ 支持连续对话（自动保持上下文）
- ✅ 支持代理配置
- ✅ 支持官方 API 和非官方反向代理两种模式
- ✅ 支持敏感词过滤
- ✅ 消息队列管理，避免并发问题
- ✅ 自动重试机制（最多 5 次）

## 安装

### 1. 克隆插件

```bash
cd Yunzai-Bot/plugins
git clone https://github.com/Micuks/chatGPT-yunzai.git
```

### 2. 安装依赖

```bash
cd chatGPT-yunzai
pnpm install
```

### 3. 配置

```bash
cd config
cp config.default.js config.js
```

编辑 `config.js`，填入你的配置：

```javascript
// OpenAI API Key（官方模式必须）
const API_KEY = "sk-xxx";

// 代理地址（可选）
const PROXY = "http://127.0.0.1:7890";

// 启用 GPT-4（需要 ChatGPT Plus 订阅）
const USE_GPT4 = true;

// 启用 Google Bard
const USE_BARD = false;
const BARD_COOKIE = "__Secure-1PSID=xxx";
```

### 4. 启动

```bash
cd Yunzai-Bot
npm run start
```

## 配置说明

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `API_KEY` | OpenAI API 密钥 | 空 |
| `PROXY` | 代理地址 | 空 |
| `MODEL_NAME` | 模型名称 | `gpt-3.5-turbo-0301` |
| `USE_GPT4` | 是否启用 GPT-4 | `false` |
| `USE_BARD` | 是否启用 Bard | `false` |
| `BARD_COOKIE` | Bard Cookie | 空 |
| `USE_UNOFFICIAL` | 使用非官方模式 | `false` |
| `API_ACCESS_TOKEN` | 非官方模式访问令牌 | 空 |
| `CONCURRENCY_JOBS` | 并发任务数 | 1 |

## 使用模式

### 官方模式（推荐）

使用 OpenAI 官方 API，稳定可靠：

```javascript
const API_KEY = "sk-your-api-key";
const USE_UNOFFICIAL = false;
```

### 非官方模式

使用反向代理，免费但有速率限制：

```javascript
const USE_UNOFFICIAL = true;
const API_ACCESS_TOKEN = "your-access-token";
```

获取 Access Token：访问 https://chat.openai.com/api/auth/session

## 注意事项

1. 官方模式需要 OpenAI API 额度
2. 非官方模式可能不稳定，且存在安全风险
3. Google Bard 对 Cookie 检测严格，体验可能不佳
4. 十分钟内无交流会自动重置对话

## 许可证

MIT