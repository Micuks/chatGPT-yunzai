# 使用openAI API的Yunzai-Bot(v3)的chatGPT插件
> 带有官方 OpenAI API 或带有反向代理的非官方 OpenAI API 的 Yunzai-Bot 的 ChatGPT 插件。
> 使用openAI官方API或反向代理非官方API的Yunzai-Bot(v3)的chatGPT插件。

- [用法](#用法)
     - [官方版](#用法---官方-chatgpt)
     - [非官方版本](#用法---非官方-chatgpt)
- [配置](#配置)
- [帮助](#帮助)

## 用法

要将此插件用于 Yunzai-Bot，您需要在这两种方法之间进行选择。
这两种方法都可以记住您的聊天记录。

| 方法 | 费用 | 质量 |
|---|---|---|
|`正式版`| OpenAI 积分 | 最佳 |
|`非官方版本` | 免费 | 速率限制； 不太健壮 |

1. `官方版`——使用OpenAI官方的`gpt-3.5-turbo`（或
    `gpt-3.5-turbo-0301`，你可以在 `config.js` 中指定）模型。 很鲁棒，
    但不是免费的。
2.`非官方版`-使用非官方的反向代理服务器访问
    聊天GPT。 它有速率限制，并且 **将您的访问令牌暴露给第三方
    服务器**，而且不那么健壮。 但是**它是免费的**。

**注意**：我建议你使用官方版本，因为它有 OpenAI 的
服务质量的保证。 如果您在使用本插件时遇到问题，
请[打开一个问题](https://github.com/Micuks/chatGPT-yunzai/issues)。

**关于代理**：如果要设置代理等，参考(#配置)
部分。

### 用法 - 官方 ChatGPT

0.注册一个[OpenAI API Key](https://platform.openai.com/overview)，这是
以后需要。

1. 将此存储库克隆到 Yunzai-Bot 文件夹中的 `plugins/` 文件夹中。
```狂欢
cd 云在-Bot
光盘插件
git clone https://github.com/Micuks/chatGPT-yunzai.git
```

2. 复制 `config.default.js` 并在 config 文件夹中将其重命名为 `config.js`。
```狂欢
光盘配置
cp config.default.js 配置.js
```

3. 将您的 OpenAI API 密钥填写到 `config.js` 中的 `API_KEY` 部分，可以通过您的 OpenAI 帐户在 [查看您的 API 密钥](https://platform.openai.com/account/api-keys ).

4.更新依赖使用pnpm或npm。
```狂欢
# 在chatGPT-yunzai文件夹下
pnpm更新
# 或者 npm update 如果你改用 npm。
# 或者 npm 安装 chatgpt bull
```

5.运行Yunzai-Bot，提问！
```狂欢
# 在Yunzai-Bot根目录下
npm 运行开始
```

```
#在QQ
?告诉我一些关于 Python 的事情
```
![示例](./docs/example.png)

### 用法 - 非官方 ChatGPT

1. 将此存储库克隆到 Yunzai-Bot 文件夹中的 `plugins/` 文件夹中。
```狂欢
cd 云在-Bot
光盘插件
git clone https://github.com/Micuks/chatGPT-yunzai.git
```

2. 不同于官方的ChatGPT，这个版本需要一个OpenAI access token
而不是 OpenAI API 密钥。 为此，我为您提供了一个 python 脚本
`get_access_token.py`。 确保你已经安装了 **python3**。 然后安装
获取访问令牌的要求。
```狂欢
pip install -r requirements.txt
pnpm更新
pnpm 安装 chatgpt bull
```

3. 复制 `config.default.js` 并在 config 文件夹中将其重命名为 `config.js`。
```狂欢
光盘配置
cp config.default.js 配置.js
```

4.运行
以下命令获取访问令牌。
```狂欢
python3 get_access_token.py
# 填写你的OpenAI邮箱和密码，然后复制你之前的access token
给出。
```

然后将访问令牌粘贴到 config.js 中的 API_ACCESS_TOKEN 部分。

6.运行Yunzai-Bot，提问！
```狂欢
# 在Yunzai-Bot根目录下
npm 运行开始
```

## 配置

此处描述了 config.js 中的部分。

| 键 | 说明 |
|---|---|
| USE_UNOFFICIAL | `true` 使用非官方版本，`false` 使用官方版本 |
| PROXY | 填写您的代理网址。 例如，`http://127.0.0.1:7890` |
| MODEL_NAME| 您要使用的模型。 默认不需要修改 |
| API_KEY | OpenAI API 密钥。 需要正式版 |
| API_REVERSE_PROXY_URL | 非官方的 ChatGPT 反向代理服务器。 如果您不知道这是什么，请将其留空。 |
| API_ACCESS_TOKEN | 如果您使用非官方版本，这是必需的 |
| MODEL_PAID | 如果您使用 **非官方** 并订阅了 **ChatGPT Plus**，请将其设置为 `true` |

## 帮助

该插件具有以下特点：

| 语法 | 说明 | 许可 |
|---|---|---|
| #chatgpt帮助 或 #chatgpthelp | 显示插件的帮助信息 | 所有人 |
| #聊天列表 | 显示所有可用的聊天 | 主人 |
| #结束对话 | 让 ChatGPT 忘记这个聊天并创建一个新聊天 | 所有人 |
| ?问题 或 !问题 | 向 ChatGPT 提问。 记得使用 `?` 和 `!`，而不是 `？` 和 `！` | 所有人 |
