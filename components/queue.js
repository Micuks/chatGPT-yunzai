import Bull from "bull";
import QueueEvents from "bull";
import { ChatGPTAPI, ChatGPTUnofficialProxyAPI } from "chatgpt";
import { isChatExpired, isBlocked, initAPI } from "./utils.js";
import Question from "./question.js";

const chatGPTAPI = await initAPI();

export default class QuestionQueue {
  constructor() {
    this.queue = new Bull("questionQueue");
    this.chatGPTAPI = chatGPTAPI;
  }

  enQueue = async (question) => {
    await this.queue.add(question);
  };

  async controller() {
    this.queue.process(async (job) => {
      return this.askAndReply(job);
    });
  }

  async removeJob(job) {
    job.remove();
  }

  askAndReply = async (job) => {
    const question = job.data.question;
    const chat = job.data.chat;
    try {
      const res = await this.chatGPTAPI.sendMessage(question, chat);
      logger.info(`Get response text: ${res.text}`);

      if (isBlocked(res.text)) {
        return "Sensitive word in response.";
      }

      this.updateChat(res, job);
      return res.text;
    } catch (err) {
      logger.error(err);
      if (err.message.includes("conversationId")) {
        this.removeExpiredChat(job);
      }

      return (
        `An error occurred while answering this question. please again try later.\n` +
        `${err.message.slice(0, 50)}\n`
      );
    }
  };

  updateChat = async (res, job) => {
    let chat = {
      conversationId: res.conversationId,
      parentMessageId: res.id,
    };
    let prevChat = {
      sender: job.data.sender,
      chat: chat,
      utime: new Date(),
      ctime: job.data.prevChat.ctime,
      count: job.data.prevChat.count + 1,
    };
    await redis.set(
      `CHATGPT:CHATS:${prevChat.sender.user_id}`,
      JSON.stringify(prevChat)
    );
  };

  getUserSetting = async () => {
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
  };

  async removeExpiredChat(expiredChat) {
    logger.info(`${expiredChat.data.prevChat.sender}'s chat expired.`);
    expiredChat.remove();
  }
}
