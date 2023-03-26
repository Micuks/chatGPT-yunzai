import Bull from "bull";
import { initAPI, initBard, isBlocked } from "./utils.js";
import { Config } from "../config/config.js";

const chatGPTAPI = initAPI();
const bardAPI = initBard();

export default class QuestionQueue {
  constructor() {
    this.queue = new Bull("questionQueue");
    this.chatGPTAPI = chatGPTAPI;
    this.bardAPI = bardAPI;
  }

  enQueue = (question) => {
    return this.queue.add(question, {
      timeout: (Config.useGpt4) ? 180000 : 60000,
    });
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
        }. If someone ask you who you are, tell him he can know more about you at "https://github.com/Micuks/chatGPT-yunzai"\n\n`,
      conversationId: job.data.prevChat?.chat?.conversationId,
      parentMessageId: job.data.prevChat?.chat?.parentMessageId,
    };
  };

  askAndReply = async (job) => {
    const question = job.data.question;
    if (question[0] == "B") {
      return await this.bardAskAndReply(job);
    } else {
      return await this.gptAskAndReply(job);
    }
  };

  parseResponseError = (err) => {
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
  };

  gptAskAndReply = async (job) => {
    let question = job.data.question;
    const model = this.setModel(question);
    this.chatGPTAPI._model = model;
    question = question.slice(1, question.len);
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
      return this.parseResponseError(err);
    }
  };

  bardAskAndReply = async (job) => {
    let question = job.data.question;
    question = await question.slice(1, question.len);
    const chat = this.getChat(job);
    const conversationId = chat.conversationId
      ? chat.conversationId
      : job.data.sender.user_id;
    try {
      logger.info(
        `Current Bard question: ${question}, Bard conversationId: ${conversationId}`,
      );
      // const text = await this.bardAPI.ask(question, conversationId);
      const text = await this.bardAPI.ask(question);
      logger.info(`Get response text: ${text}`);
      const res = {
        text: text,
        conversationId: conversationId,
        id: job.data?.parentMessageId,
      };
      return res;
    } catch (err) {
      logger.error(err);
      return this.parseResponseError(err);
    }
  };

  setModel = (question) => {
    let model = "";
    if (question[0] == "4" && Config.useGpt4) {
      model = "gpt-4";
    } else if (Config.modelPaid) {
      model = "text-davinci-002-render-paid";
    } else {
      model = "text-davinci-002-render-sha";
    }
    return model;
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
    await expiredChat.remove();
  }
}
