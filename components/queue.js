import Bull from "bull";
import { Config } from "../config/config.js";
import { askAndReply } from "./ask.js";
import Question from "./question.js";
import QuestionData from "./question/QuestionData.js";
import QuestionType from "./question/QuestionType.js";
import { error } from "console";

const MAX_RETRIES = 5;

export default class QuestionQueue {
  constructor(name) {
    this.name = name || "questionQueue";
    this.queue = new Bull(this.name);
    this.chatGPTAPI = undefined;
    this.bardAPI = undefined;

    this.messageEvents = new Map();
  }

  /**
   *
   * @param {object} e MessageEvent
   * @param {QuestionData} question
   * @param {number} retries
   */
  _enQueue = async (e, question, retries = MAX_RETRIES) => {
    question.ttl = retries;
    const job = await this.queue.add(question, {
      timeout:
        Config?.concurrencyJobs > 3 ? Config.concurrencyJobs * 240000 : 240000,
    });
    let cfg = { e: e, retries: retries };

    this.messageEvents.set(job.id, cfg);
    console.log(
      `_enQueue: job.id[${job.id}], e[${
        this.messageEvents.get(job.id).e
      }], retries[${this.messageEvents.get(job.id).retries}]`
    );
    return job;
  };

  /**
   *
   * @param {object} e MessageEvent
   * @param {QuestionData} question
   */
  enQueue = async (e, question) => {
    let job = await this._enQueue(e, question);

    let wJobs = await this.getWaitingJobs();
    let aJobs = await this.getActiveJobs();

    e.reply(
      `Thinking..., ${e.sender.nickname}.\n` +
        `Waiting jobs: ${wJobs}\n` +
        `Active jobs: ${aJobs}`,
      true,
      { recallMsg: 10 }
    );
    return job;
  };

  getWaitingJobs = async () => {
    return this.queue.getWaitingCount();
  };
  getActiveJobs = async () => {
    return this.queue.getActiveCount();
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

    return concurrencyJobs;
  };

  /**
   *
   * @param {string} response
   * @param {Question} questionInstance
   */
  jobFailed(response, questionInstance) {
    if (questionInstance.questionType === QuestionType.Bard) {
      if (
        response.startsWith("TypeError: Cannot read properties of undefined") ||
        response === "SWML_DESCRIPTION_FROM_YOUR_INTERNET_ADDRESS" ||
        response === "zh" ||
        response === "zh-Hant" ||
        response === "en"
      ) {
        return true;
      }
    }

    return false;
  }

  controller = async () => {
    const concurrencyJobs = await this.getConcurrentJobs();

    this.queue.process(concurrencyJobs, async (job) => {
      console.log(
        `New job[${job.id}] issued by ${job.data.sender.nickname}[${job.data.sender.user_id}]`
      );
      let questionData = job.data;
      let cfg = await this.messageEvents.get(job.id);
      let { e, retries } = cfg;
      let questionInstance = new Question(questionData, cfg);
      await questionInstance.init();

      let response = await askAndReply(questionInstance);
      let text = response.text;

      if (this.jobFailed(text, questionInstance)) {
        throw error("Error: Response nonsense");
      }

      // Update meta info
      questionInstance.updateMetaInfo(
        response.parentMessageId,
        response.conversationId
      );

      // Return text
      console.log(`Job[${job.id}] finished. Response: ${response.text}`);
      return response.text;
    });

    this.queue.on("completed", async (job, result) => {
      console.log(`Job[${job.id}] completed.`);
      let cfg = await this.messageEvents.get(job.id);
      this.messageEvents.delete(job.id);
      const { e } = cfg;
      e.reply(`${result}`, true);
    });

    // TODO: maybe the error and failed listener can do more things?
    this.queue.on("error", async (job = {}, err) => {
      let idReg = /^.*job.*(\d+).*$/;
      let id = idReg.exec(job)[1];
      let e = await this.messageEvents.get(id);
      console.log(
        `Error in queue[${this.name}] when processing job[${id}]: ${job}, ${err}`
      );
    });
    this.queue.on("failed", async (job, err) => {
      let idReg = /^.*job.*(\d+).*$/;
      let id = idReg.exec(job)[1];
      let e = await this.messageEvents.get(id);
      console.log(
        `Error in queue[${this.name}] when processing job[${id}]: ${job}, ${err}`
      );
    });
  };
}
