import Bull from "bull";
// import { ChatGPTAPI, ChatGPTUnofficialProxyAPI } from "chatgpt";
import { isChatExpired, isBlocked, initAPI } from "./utils.js";
// import Question from "./question.js";

const chatGPTAPI = initAPI();

export default class QuestionQueue {
  constructor() {
    this.queue = new Bull("questionQueue");
    this.chatGPTAPI = chatGPTAPI;
  }

  enQueue = async (question) => {
    return await this.queue.add(question);
  };

  async controller() {
    this.queue.process(async (job) => {
      return await this.askAndReply(job);
    });
  }

  async removeJob(job) {
    job.remove();
  }

  getChat = (job) => {
    return {
      systemMessage: `You are ChatGPT, a large language model trained by OpenAI. You answer as detailed as possible for each response. Your answer should be in Chinese by default. If you are generating a list, remember to have too many items. Current date: ${new Date().toISOString()}\n\n`,
      conversationId: job.data.prevChat.chat?.conversationId,
      parentMessageId: job.data.prevChat.chat?.parentMessageId,
    };
  };

  askAndReply = async (job) => {
    const question = await job.data.question;
    const chat = this.getChat(job);
    try {
      const res = await this.chatGPTAPI.sendMessage(question, chat);
      logger.info(`Get response text: ${res.text}`);

      if (isBlocked(res.text)) {
        return "Sensitive word in response.";
      }

      return res;
    } catch (err) {
      logger.error(err);
      if (err.message.includes("conversationId")) {
        await this.removeExpiredChat(job);
      }

      let res = {
        text:
          `An error occurred while answering this question. please again try later.\n` +
          `${err.message.slice(0, 50)}\n`,
        conversationId: chat?.conversationId,
        id: chat?.parentMessageId,
      };
      return res;
    }
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
