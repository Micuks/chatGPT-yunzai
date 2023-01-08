import plugin from "../../../lib/plugins/plugin.js";
import _ from "lodash";
import { Config } from "../config/config.js";
import showdown from "showdown";
import mjAPI from "mathjax-node";
import { ChatGPTAPIBrowser } from "chatgpt";
import { readdirSync } from "fs";

const blockWords = ["Block1", "Block2", "Block3"];
const converter = new showdown.Converter({
  extensions: [],
});

/**
 * How long does each chat preserved in seconds.
 */
const CHAT_PRESERVE_TIME = 600;

mjAPI.config({
  MathJax: {
    // traditional MathJax configuration
  },
});
mjAPI.start();

export class chatgpt extends plugin {
  constructor() {
    super({
      name: "ChatGPT",
      dsc: "chatgpt by openai",
      /** https://oicqjs.github.io/oicq/#events */
      event: "message",
      priority: 15000,
      rule: [
        {
          reg: "^[^#][sS]*",
          fnc: "chat",
        },
        {
          reg: "^#聊天列表$",
          fnc: "getChats",
          permission: "master",
        },
        {
          reg: "^#结束聊天([sS]*)$",
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
  }

  async getChats(e) {
    let keys = await redis.keys("CHATGPT:CHATS:*");
    if (!keys || keys.length === 0) {
      await this.reply("No chats now.", true);
    } else {
      let response = "Current chats:\n";
      response += "Sender | Chat length | Start time | Last active time\n";
      await Promise.all(
        keys.map(async (key) => {
          let chat = await redis.get(key);
          if (chat) {
            chat = JSON.parse(chat);
            response += `${chat.sender.nickname} | ${chat.num} | ${chat.ctime} | ${chat.utime}\n`;
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
    if (!e.msg || e.msg.startsWith("#")) {
      return;
    }
    if (e.isGroup && !(e.atme || e.msg.startsWith("?"))) {
      return;
    }
    let settings = {
      email: Config.username,
      password: Config.password,
      proxyServer: Config.proxy,
      nopechaKey: Config.nopechaKey,
    };

    await redis.set("CHATGPT:API_SETTINGS", JSON.stringify(settings));

    this.chatGPTAPI = new ChatGPTAPIBrowser(settings);
    try {
      await this.chatGPTAPI.initSession();
    } catch (error) {
      logger.error("ChatGPT API failed to initialize session.");
      logger.error(error);
    }

    let question = e.msg.trimStart();
    logger.info(`ChatGPT question: ${question}`);
    await this.reply("I'm thinking this question, please wait...", true, {
      recallMsg: 15,
    });
    let prevChat = await redis.get(`CHATGPT:CHATS:${e.sender.user_id}`);
    let chat = null;
    if (!prevChat) {
      let ctime = new Date();
      prevChat = {
        sender: e.sender,
        count: 0,
        ctime: ctime,
        utime: ctime,
      };
    } else {
      prevChat = JSON.parse(prevChat);
      chat = {
        conversationId: prevChat.chat.conversationId,
        parentMessageId: prevChat.chat.parentMessageId,
      };
    }
    try {
      let settings = {
        onChatResponse: function (c) {
          prevChat.chat = {
            conversationId: c.conversationId,
            parentMessageId: c.message.Id,
          };
          redis.set(
            `CHATGPT:CHATS:${e.sender.user_id}`,
            JSON.stringify(prevChat)
          );
        },
      };
      if (chat) {
        settings = Object.assign(settings, chat);
      }
      let res = await this.chatGPTAPI.sendMessage(question, settings);
      // const blockWord = blockWords.find((word) =>
      //   response.toLowerCase().includes(word.toLowerCase())
      // );
      // if (blockWord) {
      //   await this.reply("Sensitive word in response.", true);
      //   return;
      // }
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
        await this.reply(`${res.response}`, e.isGroup);
      }
    } catch (e) {
      logger.error(e);
      await this.reply(
        `Error answering the question, please try later.\n${e}`,
        true
      );
    }
  }
}
