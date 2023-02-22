# 使用openAI官方API或反向代理非官方API的Yunzai-Bot(v3)的chatGPT插件
> ChatGPT plugin for Yunzai-Bot with official OpenAI API or unofficial OpenAI API with reverse proxy.

## Usage

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

3. Fill in your OpenAI API Key, which can be obtained with your OpenAI account at [view your API keys](https://platform.openai.com/account/api-keys).

4. Update dependences use pnpm or npm.
```bash
# In chatGPT-yunzai folder
pnpm update
# or npm update if you use npm instead.
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

## Help

Send '#chatgpt帮助' or '#chatgpthelp' to get help in QQ.
