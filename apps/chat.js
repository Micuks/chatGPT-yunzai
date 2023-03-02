import { ChatGPTAPI, ChatGPTUnofficialProxyAPI } from "chatgpt";
// import oraPromise from "ora";
import plugin from "../../../lib/plugins/plugin.js";
import { Config } from "../config/config.js";
import QuestionQueue from "./queue";
import Question from "./question";

const blockWords = ["Block1", "Block2", "Block3"];

let chatGPTAPI = initAPI();
let questionQueue = new QuestionQueue();

async function initAPI() {
  let settings = {
    proxyServer: Config.proxy,
    debug: false, // true for debug
  };
  // Configure nopecha key to pass reCaptcha validation.
  if (Config.nopechaKey.length) {
    settings.nopechaKey = Config.nopechaKey;
  }

  let chatGPTAPI = null;

  if (Config.useUnofficial) {
    // settings.debug = true;
    if (Config.apiReverseProxyUrl.length) {
      settings.apiReverseProxyUrl = Config.apiReverseProxyUrl;
    }
    settings.accessToken = Config.apiAccessToken;

    // Set model to be paid or free.
    if (Config.modelPaid) {
      logger.info("Use paid model. Wish you were in ChatGPT plus plan!");
      settings.completionParams = {
        model: "text-davinci-002-render-paid",
      };
    } else {
      settings.completionParams = {
        model: "text-davinci-002-render-sha",
      };
    }

    chatGPTAPI = new ChatGPTUnofficialProxyAPI(settings);
  } else {
    if (Config.modelName.len) {
      settings.completionParams = {
        model: Config.modelName,
      };
      logger.info(`Using model ${Config.modelName}`);
    }
    settings.apiKey = Config.api_key;
    chatGPTAPI = new ChatGPTAPI(settings);
  }

  redis.set("CHATGPT:API_SETTINGS", JSON.stringify(settings));

  return chatGPTAPI;
}

export class chatgpt extends plugin {
  constructor() {
    super({
      name: "ChatGPT",
      dsc: "chatgpt by openai",
      event: "message",
      priority: 1500,
      rule: [
        {
          reg: "^[\\s]*\\?[\\s\\S]*",
          fnc: "chat",
        },
        {
          reg: "^#聊天列表$",
          fnc: "getChats",
          permission: "master",
        },
        {
          reg: "^#(结束|停止)(聊天|对话)([\\s\\S]*)$",
          fnc: "destroyChat",
        },
        {
          reg: "#图片聊天",
          fnc: "picMode",
        },
        {
          reg: "#文本聊天",
          fnc: "txtMode",
        },
      ],
    });

    this.chatGPTAPI = chatGPTAPI;
    this.questionQueue = questionQueue();
    this.questionQueue.yunzai = this;
  }

  main = async () => {
    this.questionQueue.controller();
  };

  async getChats(e) {
    let keys = await redis.keys("CHATGPT:CHATS:*");
    if (!keys || keys.length === 0) {
      await this.reply("No chats now.", true);
    } else {
      let response = "Current chats:\n";
      // response += "Sender | Call counts | Start time | Last active time\n";
      await Promise.all(
        keys.map(async (key) => {
          let chat = await redis.get(key);
          if (chat) {
            chat = JSON.parse(chat);
            response += `${chat.sender.nickname}:\n\tCall counts: ${chat.count}\n\tStart time: ${chat.ctime}\n\tLast active time: ${chat.utime}\n`;
          }
        })
      );
      await this.reply(`${response}`, true);
    }
  }

  async destroyChat(e) {
    let atMessages = e.message.filter((m) => m.type === "at");
    if (atMessages.length === 0) {
      let chat = await redis.get(`CHATGPT:CHATS:${e.sender.user_id}`);
      if (!chat) {
        await this.reply("No chats currently", true);
      } else {
        await redis.del(`CHATGPT:CHATS:${e.sender.user_id}`);
        await this.reply(
          "Destroyed current chat, @me to start new chat.",
          true
        );
      }
    } else {
      let at = atMessages[0];
      let qq = at.qq;
      let atUser = _.trimStart(at.text, "@");
      let chat = await redis.get(`CHATGPT:CHATS:${qq}`);
      if (!chat) {
        await this.reply(`No chats are opened by ${atUser}`, true);
      } else {
        await redis.del(`CHATGPT:CHATS:${qq}`);
        await this.reply(`Destroyed chats of ${atUser}[${qq}]`, true);
      }
    }
  }

  async picMode(e) {
    let userSetting = await redis.get(`CHATGPT:USERS:${e.sender.user_id}`);
    if (!userSetting) {
      userSetting = { usePicture: true };
    } else {
      userSetting = JSON.parse(userSetting);
    }
    userSetting.usePicture = true;
    await redis.set(
      `CHATGPT:USERS:${e.sender.user_id}`,
      JSON.stringify(userSetting)
    );
    await this.reply(
      `ChatGPT reply mode of ${e.sender.user_id} switched to picture mode.`,
      true
    );
  }

  async txtMode(e) {
    let userSetting = await redis.get(`CHATGPT:USERS:${e.sender.user_id}`);
    if (!userSetting) {
      userSetting = { usePicture: false };
    } else {
      userSetting = JSON.parse(userSetting);
    }
    userSetting.usePicture = false;
    await redis.set(
      `CHATGPT:USERS:${e.sender.user_id}`,
      JSON.stringify(userSetting)
    );
    await this.reply(
      `ChatGPT reply mode of ${e.sender.user_id} switched to text mode.`,
      true
    );
  }

  async chat(e) {
    const question = new Question(e, e.msg.slice(1, e.msg.len));
    this.questionQueue.add(question);
    this.questionQueue.controller();
  }
}
