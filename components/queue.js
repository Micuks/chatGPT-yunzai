import Bull from "bull";
// import { ChatGPTAPI, ChatGPTUnofficialProxyAPI } from "chatgpt";
import { initAPI, isBlocked } from "./utils.js";
// import Question from "./question.js";

const chatGPTAPI = initAPI();

export default class QuestionQueue {
  constructor() {
    this.queue = new Bull("questionQueue");
    this.chatGPTAPI = chatGPTAPI;
  }

  enQueue = (question) => {
    return this.queue.add(question, { timeout: 60000 });
  };

  controller() {
    this.queue.process(1, async (job) => {
      return await this.askAndReply(job);
    });
  }

  async removeJob(job) {
    await job.remove();
  }

  getChat = (job) => {
    return {
      systemMessage:
        `You are ChatGPT, a large language model trained by OpenAI. You answer as detailed as possible for each response. Your answer should be in Chinese by default. If you are generating a list, remember to have too many items. Current date: ${
          new Date().toISOString()
        }\n\n`,
      conversationId: job.data.prevChat.chat?.conversationId,
      parentMessageId: job.data.prevChat.chat?.parentMessageId,
    };
  };

  askAndReply = async (job) => {
    const question = await job.data.question;
    const chat = this.getChat(job);
    try {
      logger.info(`Current question: ${question}`);
      const res = await this.chatGPTAPI.sendMessage(question, chat);
      logger.info(`Get response text: ${res.text}`);

      if (isBlocked(res.text)) {
        return "Sensitive word in response.";
      }

      return res;
    } catch (err) {
      logger.error(err);
      if (err.message.includes("conversationId")) {
        return {
          text: `Your chat is expired. I've removed your chat for you.`,
          conversationId: undefined,
          id: undefined,
          error: "Chat expired.",
        };
      } else {
        return {
          text:
            `An error occurred while answering this question. please again try later.\n` +
            `${err.message.split("\n")[0]}\n`,
          conversationId: chat?.conversationId,
          id: chat?.parentMessageId,
          error: '${err.message.split("\n")[0]}',
        };
      }
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
