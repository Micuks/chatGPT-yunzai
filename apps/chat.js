import { ChatGPTAPI, ChatGPTUnofficialProxyAPI } from "chatgpt";
import oraPromise from "ora";
import plugin from "../../../lib/plugins/plugin.js";
import { Config } from "../config/config.js";

const blockWords = ["Block1", "Block2", "Block3"];

let chatGPTAPI = initAPI();

function initAPI() {
  let settings = {
    proxyServer: Config.proxy,
  };
  // Configure nopecha key to pass reCaptcha validation.
  if (Config.nopechaKey.length) {
    settings.nopechaKey = Config.nopechaKey;
  }

  let chatGPTAPI = null;

  if (Config.useUnofficial) {
    settings.debug = true;
    if (Config.apiReverseProxyUrl !== "") {
      settings.apiReverseProxyUrl = Config.apiReverseProxyUrl;
    }
    settings.username = Config.username;
    settings.password = Config.password;
    settings.accessToken = Config.apiAccessToken;
    chatGPTAPI = new ChatGPTUnofficialProxyAPI(settings);
  } else {
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
          reg: "^[\\?\\uFF1F][\\s\\S]*",
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
  }

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
            response +=
              `${chat.sender.nickname}:\n\tCall counts: ${chat.count}\n\tStart time: ${chat.ctime}\n\tLast active time: ${chat.utime}\n`;
          }
        }),
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
          true,
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
      JSON.stringify(userSetting),
    );
    await this.reply(
      `ChatGPT reply mode of ${e.sender.user_id} switched to picture mode.`,
      true,
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
      JSON.stringify(userSetting),
    );
    await this.reply(
      `ChatGPT reply mode of ${e.sender.user_id} switched to text mode.`,
      true,
    );
  }

  async chat(e) {
    if (!e.msg || e.msg.startsWith("#")) {
      return;
    }
    if (e.isGroup && !(e.atme || e.msg.startsWith("?"))) {
      return;
    }
    // Create new ChatGPTAPIBrowser if not exists
    if (!this.chatGPTAPI) {
      logger.error("No available ChatGPT API.");
      e.reply("No ChatGPT API available.");
      return false;
    }

    let question = e.msg.trimStart();
    logger.info(`ChatGPT question: ${question}`);
    await this.reply("I'm thinking this question, please wait...", true, {
      recallMsg: 15,
    });
    let prevChat = await redis.get(`CHATGPT:CHATS:${e.sender.user_id}`);
    // Prompt prefix
    let chat = {
      promptPrefix:
        `You are ChatGPT, a large language model trained by OpenAI. You answer as detailed as possible for each response. Your answer should be in Chinese by default. If you are generating a list, remember to have too many items. Current date: ${
          new Date().toISOString()
        }\n\n`,
    };
    if (!prevChat) {
      logger.info(
        `No previous chats of ${e.sender.username}[${e.sender.user_id}]`,
      );
      let ctime = new Date();
      prevChat = {
        sender: e.sender,
        count: 0,
        ctime: ctime,
        utime: ctime,
      };
    } else {
      prevChat = JSON.parse(prevChat);
      chat = Object.assign({}, chat, {
        conversationId: prevChat.chat.conversationId,
        parentMessageId: prevChat.chat.parentMessageId,
      });
    }
    try {
      let res = await this.chatGPTAPI.sendMessage(question, chat);

      logger.info(`Get response text: ${res.text}`);

      const blockWord = blockWords.find((word) =>
        res.text.toLowerCase().includes(word.toLowerCase())
      );
      if (blockWord) {
        await this.reply("Sensitive word in response.", true);
        return;
      }
      let userSetting = await redis.get(`CHATGPT:USER:${e.sender.user_id}`);
      if (userSetting) {
        userSetting = JSON.parse(userSetting);
      } else {
        userSetting = {
          usePicture: false,
        };
      }
      if (userSetting.usePicture) {
        // TODO
      } else {
        await this.reply(`${res.text}`, e.isGroup);
      }

      // Update chat conversationId and parentMessageId for continuous chat
      chat = {
        conversationId: res.conversationId,
        parentMessageId: res.id,
      };
      prevChat.chat = chat;
      prevChat.utime = new Date();
      prevChat.count += 1;
      redis.set(`CHATGPT:CHATS:${e.sender.user_id}`, JSON.stringify(prevChat));
    } catch (error) {
      logger.error(error);
      await this.reply(
        `Error answering the question, please try later.\n${error}`,
        true,
      );
    }
  }
}
