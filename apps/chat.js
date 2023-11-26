// import oraPromise from "ora";
import plugin from "../../../lib/plugins/plugin.js";
import QuestionQueue from "../components/queue.js";
import Question from "../components/question.js";
import { Config } from "../config/config.js";
import QuestionData from "../components/question/QuestionData.js";

const questionQueue = new QuestionQueue();
questionQueue.controller();

export class chatgpt extends plugin {
  constructor() {
    super({
      name: "ChatGPT",
      dsc: "chatgpt by openai",
      event: "message",
      priority: 65536, // Larger number, lower priority
      rule: [
        {
          reg: "^[\\s]*(\\?|!|4|B)[\\s\\S]*",
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
          reg: "#(清除队列|清空队列)",
          fnc: "cleanQueue",
        },
        {
          reg: "[^#].+$",
          fnc: "randomReply",
          dsc: "概率随机回复幽默内容",
        },
      ],
    });

    this.questionQueue = questionQueue;
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
            response += `${chat.sender.nickname}:\n\tRequest count: ${chat.count}\n\tStart time: ${chat.ctime}\n\tLast active time: ${chat.utime}\n`;
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
        await this.reply("You are not chatting with me.", true);
      } else {
        await redis.del(`CHATGPT:CHATS:${e.sender.user_id}`);
        await this.reply("Chat destroyed.", true);
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

  async chat(e) {
    const msg = e.msg;
    const question = new QuestionData(msg, e);

    const job = await this.questionQueue.enQueue(e, question);
  }

  async callback(e, response) {
    this.e = e;
    await this.reply(response.text, true);
    await this.updateChat(e, response);
  }

  async gptUpdateChat(e, res) {
    let prevChat = await redis.get(`CHATGPT:CHATS:${e.sender.user_id}`);
    prevChat = await JSON.parse(prevChat);
    const chat = res.error
      ? {
          conversationId: undefined,
          parentMessageId: undefined,
        }
      : {
          conversationId: res?.conversationId,
          parentMessageId: res?.id,
        };
    prevChat = {
      sender: e.sender,
      chat: chat,
      utime: new Date(),
      ctime: prevChat?.ctime ? prevChat.ctime : new Date(),
      count: prevChat?.count + 1,
      conversationId: res?.conversationId,
    };

    await redis.set(
      `CHATGPT:CHATS:${e.sender.user_id}`,
      JSON.stringify(prevChat)
    );
  }

  async bardUpdateChat(e, res) {
    let prevChat = await redis.get(`CHATGPT:BARD_CHATS:${e.sender.user_id}`);
    prevChat = await JSON.parse(prevChat);
    const chat = res.error
      ? {
          conversationId: e.sender.user_id,
          parentMessageId: undefined,
        }
      : {
          conversationId: e.sender.user_id,
          parentMessageId: res?.id,
        };
    prevChat = {
      sender: e.sender,
      chat: chat,
      utime: new Date(),
      ctime: prevChat?.ctime ? prevChat.ctime : new Date(),
      count: prevChat?.count + 1,
      conversationId: prevChat?.conversationId
        ? prevChat.conversationId
        : e.sender.user_id,
    };

    await redis.set(
      `CHATGPT:BARD_CHATS:${e.sender.user_id}`,
      JSON.stringify(prevChat)
    );
  }

  async updateChat(e, questionData) {
    let questionInstance = new Question(questionData);
    questionInstance.updateMetaInfo();
    switch (e.msg[0]) {
      case "B":
        await this.bardUpdateChat(e, res);
        break;
      default:
        await this.gptUpdateChat(e, res);
        break;
    }
  }

  async cleanQueue(e) {
    this.questionQueue.queue.clean(5000, "active");
    this.questionQueue.queue.clean(5000, "wait");
    logger.info("Successfully cleaned active job queue!");
    await e.reply("清空队列完毕");
  }

  async randomReply(e) {}

  async randomReplyCheck(e) {}
}
