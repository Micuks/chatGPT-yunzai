# chatGPT-yunzai

这是一个运行在 Yunzai-Bot(v3) 之上的 OpenClaw for QQ 链接件。

按当前实际用途，这个仓库承担的是 OpenClaw for QQ 的 Yunzai 侧接入层：接收 QQ 侧聊天指令，维护按用户区分的会话状态，处理排队，再把请求转发到已配置的 LLM 后端。

按当前代码实现，插件实际支持的能力是：

- 通过 OpenAI 官方 `ChatGPTAPI` 或非官方反向代理方式发起对话
- 在开启 `USE_GPT4` 后，使用 `gpt4` 或 `/gpt4` 触发 GPT-4
- 在开启 `USE_BARD` 后，使用 `bard` 或 `/bard` 触发 Google Bard
- 按用户在 Redis 中保存会话上下文，10 分钟无活动后重置
- 基于 Bull 的请求队列，可配置并发数
- 任务失败后自动重试
- 在最终回复前做一层简单的屏蔽词拦截
- 帮助命令和清空队列命令

英文说明见 [readme.md](./readme.md)。

## 安装

1. 将仓库作为 OpenClaw for QQ 链接件克隆到 Yunzai-Bot 的 `plugins/` 目录。

```bash
cd Yunzai-Bot/plugins
git clone https://github.com/Micuks/chatGPT-yunzai.git
```

2. 复制配置模板。

```bash
cd chatGPT-yunzai/config
cp config.default.js config.js
```

3. 安装依赖。

```bash
cd ../
pnpm install
```

4. 按你希望 OpenClaw for QQ 通过这个链接件接入的后端模式填写 `config/config.js`。

## 当前生效的配置项

下面这些配置会被当前运行时代码实际读取：

| 配置项 | 当前作用 |
| --- | --- |
| `PROXY` | 可选代理，ChatGPT 和 Bard 客户端都会使用 |
| `API_KEY` | OpenAI 官方模式所需 |
| `USE_UNOFFICIAL` | 切换到 `ChatGPTUnofficialProxyAPI` |
| `API_ACCESS_TOKEN` | 开启非官方模式后必填 |
| `API_REVERSE_PROXY_URL` | 非官方模式可选的反向代理地址 |
| `USE_GPT4` | 开启 `gpt4` 和 `/gpt4` 指令 |
| `USE_BARD` | 开启 `bard` 和 `/bard` 指令 |
| `BARD_COOKIE` | 开启 Bard 后必填 |
| `CONCURRENCY_JOBS` | 控制 Bull 队列并发数 |

关于模板中遗留但当前未实际生效的配置：

- `MODEL_NAME` 仍然存在于 `config.default.js`，但当前运行时代码不会用它决定模型。
- `MODEL_PAID` 已导出，但当前运行时代码不会读取它。
- 当前代码里的默认回退模型分别是 ChatGPT 的 `gpt-3.5-turbo-1106` 和 GPT-4 的 `gpt-4-0613`。

## 指令

当前代码可确认的 QQ 侧用户指令如下：

| 功能 | 指令 |
| --- | --- |
| 与 ChatGPT 对话 | `?问题`、`？问题`、`!问题`、`！问题`、`gpt 问题`、`/gpt 问题` |
| 与 GPT-4 对话 | `gpt4 问题`、`/gpt4 问题` |
| 与 Bard 对话 | `bard 问题`、`/bard 问题` |
| 查看帮助 | `#聊天帮助`、`#chatgpthelp`、`#chathelp`、`#chatmenu` |
| 清空队列 | `#清除队列`、`#清空队列` |

补充说明：

- 所有聊天前缀都会经过同一套链接件处理流程，并共享按用户保存上下文的机制，`!` 并不是单独的一种“连续对话模式”。
- 用户 10 分钟没有继续发问时，会话上下文会被重置。
- 请求进入队列时，链接件会先回复一条包含等待中和执行中任务数量的 `Thinking...` 提示。

## 代码现状说明

- 代码里仍然保留了 `#聊天列表` 和 `#结束` 或 `#停止` 聊天相关处理，但这些逻辑读取的是旧的 `CHATGPT:CHATS:*` 键，而当前实际会话数据保存在 `CHATGPT:META:*` 下，因此这里不把它们当作可靠的已支持功能写进文档。
- 屏蔽词拦截使用的是 `components/utils.js` 中的占位列表，只能算当前代码自带的一层基础过滤，不应视为完整审核系统。
- Bard 相关实现和依赖名称仍然是 Google Bard，这里按当前代码保持一致，不扩展说明到其他产品名。
