import Bull from "bull";
import { isBlocked, bardRetry, chatGPTAPI, bardAPI } from "./utils.js";
import { Config } from "../config/config.js";

export default class QuestionQueue {
  constructor() {
    this.queue = new Bull("questionQueue");
    this.chatGPTAPI = chatGPTAPI;
    this.bardAPI = bardAPI;
  }

  enQueue = (question) => {
    return this.queue.add(question, {
      timeout: Config.useGpt4 ? 180000 : 120000,
    });
  };

  controller() {
    let concurrencyJobs = Config?.concurrencyJobs * 1;
    if (
      concurrencyJobs === undefined ||
      concurrencyJobs === null ||
      concurrencyJobs === ""
    ) {
      concurrencyJobs = 1;
    }
    this.queue.process(concurrencyJobs, async (job) => {
      return await this.askAndReply(job);
    });
  }

  async removeJob(job) {
    await job.remove();
  }

  getChat = (job) => {
    return {
      systemMessage: `You are ChatGPT, a large language model trained by OpenAI, run by micuks, based on the GPT-3.5 architecture. Knowledge cutoff: 2021-09 Current date: ${new Date().toISOString()}. Your answer should be in Chinese by default. If someone ask you who you are, tell him he can know more about you at "https://github.com/Micuks/chatGPT-yunzai"\n\n`,
      conversationId: job.data.prevChat?.chat?.conversationId,
      parentMessageId: job.data.prevChat?.chat?.parentMessageId,
    };
  };

  askAndReply = async (job) => {
    const question = job.data.question;
    switch (question[0]) {
      case "B":
        return await this.bardAskAndReply(job);

      default:
        return await this.gptAskAndReply(job);
    }
  };

  parseResponseError = (err, chat) => {
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
      logger.info(
        `Current chatGPT question: ${question}, current parentMessageId: ${chat.parentMessageId}`
      );
      const res = await this.chatGPTAPI.sendMessage(question, chat);
      logger.debug(`Get response text: ${res.text}`);

      if (isBlocked(res.text)) {
        return "Sensitive word in response.";
      }

      return res;
    } catch (err) {
      logger.error(err);
      return this.parseResponseError(err, chat);
    }
  };

  bardAskAndReply = async (job) => {
    let question = job.data.question;
    question = await question.slice(1, question.len);
    const chat = this.getChat(job);
    const conversationId = chat.conversationId;
    try {
      logger.info(
        `Current Bard question: ${question}, Bard conversationId: ${conversationId}`
      );
      const text = await this.bardAPI.ask(question, conversationId);
      logger.debug(`Get response text: ${text}`);
      const res = {
        text: text,
        conversationId: conversationId,
        id: job.data?.parentMessageId,
      };
      return res;
    } catch (err) {
      logger.error(err);
      return this.parseResponseError(err, chat);
    }
  };

  setModel = (question) => {
    const gpt4 = "gpt-4";
    const sha = "text-davinci-002-render-sha";
    const paid = "text-davinci-002-render-paid";
    const bard = "Bard";
    switch (question[0]) {
      case "4":
        return Config.modelPaid ? gpt4 : sha;
      case "?":
      case "!":
        return Config.modelPaid ? paid : sha;
      case "B":
        return bard;
      default:
        return sha;
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
    await this.reply(`${res.text}`, e.isGroup);
  };

  async removeExpiredChat(expiredChat) {
    logger.info(`${expiredChat.data.prevChat.sender}'s chat expired.`);
    await expiredChat.remove();
  }
}
