// import oraPromise from "ora";
import plugin from "../../../lib/plugins/plugin.js";
import QuestionQueue from "../components/queue.js";
import Question from "../components/question.js";

const blockWords = ["Block1", "Block2", "Block3"];

export class chatgpt extends plugin {
  constructor() {
    super({
      name: "ChatGPT",
      dsc: "chatgpt by openai",
      event: "message",
      priority: 1500,
      rule: [
        {
          reg: "^[\\s]*(\\?|!)[\\s\\S]*",
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
        {
          reg: "#清除队列",
          fnc: "cleanQueue",
        },
      ],
    });

    this.questionQueue = new QuestionQueue();
    this.questionQueue.controller();
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
          'Destroyed current chat, input "?QUestion" to start new chat.',
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
    const question = new Question(e.msg.slice(1, e.msg.len), e.sender);
    question.prevChat = await question.getOrCreatePrevChat();

    const job = await this.questionQueue.enQueue(question);

    const waitingCount = await this.questionQueue.queue.getWaitingCount();

    const activeCount = await this.questionQueue.queue.getActiveCount();

    this.reply(
      `I'm thinking of your question, ${e.sender.nickname}.\n` +
        `Waiting jobs: ${waitingCount}\n` +
        `Active jobs: ${activeCount}`,
      true,
      { recallMsg: 10 },
    );

    // await this.questionQueue.controller();

    await job.finished().then(async (response) => {
      this.callback(e, response);
    });
  }

  async callback(e, response) {
    this.e = e;
    this.reply(response.text, true);
    this.updateChat(e, response);
  }

  async updateChat(e, res) {
    let prevChat = await redis.get(`CHATGPT:CHATS:${e.sender.user_id}`);
    prevChat = await JSON.parse(prevChat);
    let chat = {
      conversationId: res?.conversationId,
      parentMessageId: res?.id,
    };
    prevChat = {
      sender: e.sender,
      chat: chat,
      utime: new Date(),
      ctime: prevChat.ctime ? prevChat.ctime : new Date(),
      count: prevChat?.count + 1,
    };

    await redis.set(
      `CHATGPT:CHATS:${prevChat.sender.user_id}`,
      JSON.stringify(prevChat),
    );
  }

  async cleanQueue(e) {
    this.questionQueue.queue.clean(5000, "active");
    this.questionQueue.queue.clean(5000, "waiting");
  }
}
