import Bull from "bull";
import { Config } from "../config/config.js";
import { askAndReply } from "./ask.js";
import Question from "./question.js";
import QuestionData from "./question/QuestionData.js";
import QuestionType from "./question/QuestionType.js";
import { error } from "console";
import postProcess from "./reply.js";

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
    return job;
  };

  /**
   *
   * @param {object} e MessageEvent
   * @param {QuestionData} question
   */
  enQueue = async (e, question) => {
    let job = await this._enQueue(e, question);

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
  responseNonsense(response, questionInstance) {
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

  controller = /**
   * Bull Queue controller
   * @date 11/27/2023 - 10:41:33 AM
   *
   * @async
   * @returns {*}
   */ async () => {
    const concurrencyJobs = await this.getConcurrentJobs();

    this.queue.process(concurrencyJobs, async (job) => {
      console.debug(
        `New job[${job.id}] issued by ${job.data.sender.nickname}[${job.data.sender.user_id}]`
      );
      let questionData = job.data;
      let cfg = await this.messageEvents.get(job.id);
      let { e, retries } = cfg;
      let questionInstance = new Question(questionData, cfg);
      await questionInstance.init();

      let response = await askAndReply(questionInstance, cfg);
      let text = response.text;

      if (this.responseNonsense(text, questionInstance)) {
        throw error("nonsense Bard response");
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

    this.queue.on(
      "completed",
      /**
       * Completed job listener
       * @date 11/27/2023 - 10:42:32 AM
       *
       * @async
       * @param {import("bull").Job} job
       * @param {*} result
       * @returns {*}
       */ async (job, result) => {
        console.debug(`Job[${job.id}] completed.`);
        let cfg = await this.messageEvents.get(job.id);
        this.messageEvents.delete(job.id);
        const { e } = cfg;
        let questionData = job.data;

        // Postprocess: if result includes image url, render it.
        await postProcess(questionData, result, cfg);
      }
    );

    // HINT: error jobs are moved to failed jobs automatically
    this.queue.on(
      "error",
      /**
       * Error job listener
       * @param {string} job
       * @param {string} err
       */
      async (job, err) => {
        let idReg = /^.*job.*(\d+).*$/;
        let id = idReg.exec(job)[1];
        let e = await this.messageEvents.get(id);
        console.log(
          `Error in queue[${this.name}] when processing job[${id}]: ${job}, ${err}`
        );
        console.debug(err);
      }
    );
    this.queue.on(
      "failed",
      /**
       * Failed job listener
       * @date 11/27/2023 - 10:44:30 AM
       *
       * @async
       * @param {Bull.job} job
       * @param {error} err
       * @returns {*}
       */ async (job, err) => {
        let idReg = /^.*job.*(\d+).*$/;
        let id = undefined;
        try {
          id = idReg.exec(job)[1];
          let e = await this.messageEvents.get(id);
          console.log(
            `Error in queue[${this.name}] when processing job[${id}]: ${job}, ${err}`
          );
        } catch (err) {
          console.log(
            `Error in queue[${this.name}] when processing job${job.id}: ${err}`
          );
          // console.log(job);
        }
      }
    );
  };
}
