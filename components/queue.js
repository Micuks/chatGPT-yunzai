import Bull from "bull";
import { isBlocked, chatGPTAPI, bardAPI, MAX_RETRIES } from "./utils.js";
import { Config } from "../config/config.js";
import { askAndReply } from "./ask.js";
import Question from "./question.js";
import { deprecate } from "util";

export default class QuestionQueue {
  constructor() {
    this.queue = new Bull("questionQueue");
    this.chatGPTAPI = chatGPTAPI;
    this.bardAPI = bardAPI;

    this.messageEvents = new Map();
    this.ttl = MAX_RETRIES;
  }

  _enQueue = async (e, question) => {
    const job = await this.queue.add(question, {
      timeout:
        Config?.concurrencyJobs > 3 ? Config.concurrencyJobs * 240000 : 240000,
    });
    let cfg = { e: e };

    this.messageEvents.set(job.id, cfg);
  };

  enQueue = async (e, question) => {
    await this._enQueue(e, question);

    let wJobs = this.getWaitingJobs() || 0;
    let aJobs = this.getActiveJobs() || 0;

    e.reply(
      `Thinking..., ${e.sender.nickname}.\n` +
        `Waiting jobs: ${wJobs}\n` +
        `Active jobs: ${aJobs}`,
      true,
      { recallMsg: 10 }
    );
  };

  getWaitingJobs = () => {
    return this.queue.getWaitingCount();
  };
  getActiveJobs = () => {
    return this.queue.getWaitingCount();
  };

  getConcurrentJobs = async () => {
    let concurrencyJobs = Config?.concurrencyJobs * 1;
    if (
      concurrencyJobs === undefined ||
      concurrencyJobs === null ||
      concurrencyJobs === ""
    ) {
      concurrencyJobs = 1;
    }
  };

  async controller() {
    const concurrencyJobs = await this.getConcurrentJobs();

    this.queue.process(concurrencyJobs, async (job) => {
      let questionData = job.data;
      let cfg = this.messageEvents[job.id];
      let questionInstance = new Question(questionData, cfg);
      let response = await askAndReply(questionInstance);

      // Update meta info
      questionInstance.updateMetaInfo(
        response.parentMessageId,
        response.conversationId
      );
    });

    this.queue.on("completed", async (job, result) => {
      // TODO
    });
    this.queue.on("error", async (job, result) => {
      console.log(
        `Moving failed question job issued by ${job.e.user_id} to failed queue...`
      );
      let newJob = await job.moveToFailed({ result });

      // FIXME: The following maybe useless code
      this.messageEvents.set(newJob.id, this.messageEvents.get(job.id));
      this.messageEvents.delete(job.id);
    });
    this.queue.on("failed", async (job, result) => {
      // TODO: Not finished: redo the job if ttl > 0
      let jobE = this.messageEvents[job.data.jobIdx] || undefined;
      let question = job.data.question;
      let ttl = question.ttl;
      if (ttl > 0) {
        question.ttl -= 1;
        this.queue.add(question);
      }
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

  @deprecate
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

  bardRetry = async (question, conversationId) => {
    try {
      this.bardRetry(question, conversationId);
      // The Fucking Error issued by Bard
      const text = await this.bardAPI.bardRetry(question, conversationId);
      logger.info(`Get response text: ${text}`);
      const res = {
        text: text,
        conversationId: conversationId,
        id: job.data?.parentMessageId,
      };
      return res;
    } catch (err) {
      if (err.message.includes("Error: Cannot read properties of undefined")) {
        // Bard cookie expired.
        return {
          text: 'make sure you are using the correct cookie, copy the value of "__Secure-1PSID" cookie and set it like this:\n BARD_COOKIE = "__Secure-1PSID=<COOKIE_VALUE>")\n Also using a US proxy is recommended.\n请确保你使用了正确的Bard Cookie.',
          conversationId: conversationId,
          id: job.data?.parentMessageId,
        };
      }
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
      logger.info(`Get response text: ${text}`);
      const res = {
        text: text,
        conversationId: conversationId,
        id: job.data?.parentMessageId,
      };
      return res;
    } catch (err) {
      if (err.message.includes("Error: Cannot read properties of undefined")) {
        return await this.bardRetry(question, conversationId);
      }

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
