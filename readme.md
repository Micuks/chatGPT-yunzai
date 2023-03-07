# 使用openAI API的Yunzai-Bot(v3)的chatGPT插件
> ChatGPT plugin for Yunzai-Bot with official OpenAI API or unofficial OpenAI API with reverse proxy.
> 使用openAI官方API或反向代理非官方API的Yunzai-Bot(v3)的chatGPT插件.

- [Usage](#Usage)
    - [Official version](#usage---official-chatgpt)
    - [Unofficial version](#usage---unofficial-chatgpt)
- [Config](#config)
- [Help](#help)

## Usage

To use this plugin for Yunzai-Bot, you need to pick between these two methods.
Both methods can memory your chat history.

| Method | Cost | Quality |  
|---|---|---|
|`Official version`| OpenAI Credits | Best |
|`Unofficial version` | Free | Rate limit; Not so robust |

1. `Official version` - Uses the OpenAI official `gpt-3.5-turbo` ( or
   `gpt-3.5-turbo-0301`, you can specify in `config.js` ) model. It's rubust,
   but not free.
2. `Unofficial version` - Uses an unofficial reverse proxy server to access
   ChatGPT. It has a rate limit, and **exposes your access token to a third
   party**, and not so robust. But **it's free**.

**Note**: I recommend you to use official version for it has OpenAI's
guarantee for service quality. If you have problems when using this plugin,
please [Open an issue](https://github.com/Micuks/chatGPT-yunzai/issues).

**About proxy**: If you want to set proxy and other things, refer to [#Config]
section.

### Usage - Official ChatGPT

0. Sign up for an [OpenAI API Key](https://platform.openai.com/overview), this is
needed later.

1. Clone this reposity into `plugins/` folder in your Yunzai-Bot folder.
```bash
cd Yunzai-Bot
cd plugins
git clone https://github.com/Micuks/chatGPT-yunzai.git
```

2. Copy `config.default.js` and rename it as `config.js` in config folder.
```bash
cd config
cp config.default.js config.js
```

3. Fill your OpenAI API Key into `API_KEY` section in `config.js` , which can be obtained with your OpenAI account at [view your API keys](https://platform.openai.com/account/api-keys).

4. Update dependences use pnpm or npm.
```bash
# In chatGPT-yunzai folder
pnpm update
# or npm update if you use npm instead.
# or npm install chatgpt bull
```

5. Run Yunzai-Bot, ask questions!
```bash
# In Yunzai-Bot root folder
npm run start
```

```
# in QQ
?Tell me something about Python
```
![example](./docs/example.png)

### Usage - Unofficial ChatGPT

1. Clone this reposity into `plugins/` folder in your Yunzai-Bot folder.
```bash
cd Yunzai-Bot
cd plugins
git clone https://github.com/Micuks/chatGPT-yunzai.git
```

2. Different from official ChatGPT, this version requires an OpenAI access token
instead of an OpenAI API Key. To get this, I provide you a python script
`get_access_token.py`. Make sure you have **python3** installed. Then install
the requrements for getting access token.
```bash
pip install -r requirements.txt
pnpm update
pnpm install chatgpt bull
```

3. Copy `config.default.js` and rename it as `config.js` in config folder.
```bash
cd config
cp config.default.js config.js
```

4. run the
following commands to get access token.
```bash
python3 get_access_token.py
# Fill in your OpenAI email and password, then copy the access token you were
given.
```

Then paste the access token to `API_ACCESS_TOKEN` section in `config.js`.

6. Run Yunzai-Bot, ask questions!
```bash
# In Yunzai-Bot root folder
npm run start
```

## Config

The sections in `config.js` are described here.

| Key | Description |
| USE_UNOFFICIAL | `true` to use unofficial version, `false` to use official version |
| PROXY | Fill in your proxy url. For example, `http://127.0.0.1:7890` |
| MODEL_NAME| The model you want to use. Need not to modify by default |
| API_KEY | OpenAI API Key. Needed for Official version |
| API_REVERSE_PROXY_URL | Unofficial ChatGPT reverse proxy server. If you don't know what this is, keep it blank. |
| API_ACCESS_TOKEN | This is necessary if you use unofficial version |
| MODEL_PAID | If you use **unofficial** and subscribed **ChatGPT Plus**, set this to `true` |

## Help

This plugin has following features:

| Pattern | Description | Permission |
|---|---|---|
| #chatgpt帮助 or #chatgpthelp | Show plugin's help info | Everyone |
| #聊天列表 | Show all chats available | Master |
| #结束对话 | Let ChatGPT forget this chat and create a new chat | Everyone |
| ?Question or !Question | Ask ChatGPT a question. Remember to use `?` and `!`, not `？` and `！` | Everyone |
