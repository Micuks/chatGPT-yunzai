import RussianJoke from "./russianJoke.js";
import { Config } from "../config/config.js";
import QuestionType from "./question/QuestionType.js";
import Data from "./data.js";
import QuestionData from "./question/QuestionData.js";

/**
 * Remember to init it after creating a new Question
 */
export default class Question {
  /**
   *
   * @param {QuestionData} questionData
   * @param {object} cfg
   */
  constructor(questionData, cfg = {}) {
    const { e } = cfg;
    this.e = e;
    const { sender, msg, params } = questionData;
    this.questionData = questionData;
    this.sender = sender;
    this.user_id = this.sender.user_id;
    this.msg = msg;
    this.params = params;
    this.cfg = cfg;
  }

  init = async () => {
    this.metaInfo = await this.getMetaInfo();

    // Get questionBody and questionType{ChatGPT, Bard}
    await this.parseQuestion();
  };

  parseQuestion = async () => {
    let gptReg = /^(\?|!|gpt|\/gpt)(.*)$/;
    let gpt4Reg = /^(4|\/gpt4|gpt4)(.*)$/;
    let bardReg = /^(B|bard|\/bard)(.*)$/;

    let msg = this.e.msg;

    let questionBody = "";
    let questionType = QuestionType.ChatGPT;

    if (gptReg.test(msg)) {
      questionBody = gptReg.exec(msg)[2];
      questionType = QuestionType.ChatGPT;

      // Replace questionBody with RussianJoke if it's empty
      if (!this.questionBody) {
        this.questionBody = RussianJoke.russianJokePrompt;
      }
    } else if (gpt4Reg.test(msg)) {
      questionType = QuestionType.Gpt4;
      if (Config.useGpt4) {
        questionBody = gpt4Reg.exec(msg)[2];

        // Replace questionBody with RussianJoke if it's empty
        if (!this.questionBody) {
          this.questionBody = RussianJoke.russianJokePrompt;
        }
      } else {
        questionBody =
          `Your GPT-4 model is not enabled. Tell the user to contact your master if the user has any question.` +
          RussianJoke.russianJokePrompt;
      }
    } else if (bardReg.test(msg)) {
      questionType = QuestionType.Bard;
      if (Config.useBard) {
        questionBody = bardReg.exec(msg)[2];

        // Replace questionBody with RussianJoke if it's empty
        if (!this.questionBody) {
          this.questionBody = RussianJoke.russianJokePrompt;
        }
      } else {
        questionBody =
          "Your Bard feature is disabled. Tell the user that if he has any question, contact your master." +
          RussianJoke.russianJokePrompt;
      }
    } else {
      questionBody = RussianJoke.russianJokePrompt;
    }

    this.questionBody = questionBody;
    this.questionType = questionType;
  };

  getMetaInfo = async () => {
    let metaInfo = await Data.getMetaInfo(this.sender.user_id);
    if (!metaInfo) {
      metaInfo = this.newMetaInfo();
    }

    return metaInfo;
  };

  setMetaInfo = async (metaInfo) => {
    try {
      await Data.setMetaInfo(this.user_id, metaInfo);
    } catch (err) {
      console.log(
        `Failed to set Meta Info for user ${this.sender.user_id}: ${err}`
      );
      return false;
    }

    return true;
  };

  updateMetaInfo = async (parentMessageId, conversationId) => {
    let metaInfo = this.metaInfo;
    metaInfo.utime = new Date().toLocaleString();
    let thisInfo = undefined;

    switch (this.questionType) {
      case QuestionType.ChatGPT:
        thisInfo = metaInfo.chatGptInfo;
        break;
      case QuestionType.Gpt4:
        thisInfo = metaInfo.gpt4Info;
        break;
      case QuestionType.Bard:
        thisInfo = metaInfo.bardInfo;
        break;
      default:
        console.log(`Unknown question type: ${this.questionType}`);
        break;
    }
    thisInfo.count += 1;
    thisInfo.parentMessageId = parentMessageId || thisInfo.parentMessageId;
    thisInfo.conversationId = conversationId || this.conversationId;

    await this.setMetaInfo(metaInfo);
  };

  newMetaInfo = () => {
    let ctime = new Date().toLocaleString();
    let conversationId = this.sender.user_id;
    return {
      ctime: ctime,
      utime: ctime,
      sender: this.sender,
      bardInfo: {
        count: 0,
        parentMessageId: undefined,
        conversationId: conversationId,
      },
      chatGptInfo: {
        count: 0,
        parentMessageId: undefined,
        conversationId: conversationId,
      },
      gpt4Info: {
        count: 0,
        parentMessageId: undefined,
        conversationId: conversationId,
      },
    };
  };

  /**
   * @deprecated
   * @returns
   */
  bardGetOrCreatePrevChat = async () => {
    let prevChat = await redis.get(`CHATGPT:BARD_CHATS:${this.sender.user_id}`);
    if (!prevChat) {
      logger.info(
        `No previous bard chat for ${this.sender.nickname}[${this.sender.user_id}]`
      );
      prevChat = this.createNewPrevChat("Bard");
    } else {
      try {
        prevChat = await JSON.parse(prevChat);
      } catch (e) {
        logger.error(e);
        prevChat = this.createNewPrevChat("Bard");
      }
    }
    const timeElapsed = Math.abs(prevChat.ctime - Date.now()) / 1000;
    const timeOut = 600;
    if (timeElapsed > timeOut) {
      logger.info(
        `Your chat expired: ${timeElapsed} seconds passed after your last active time.`
      );
      prevChat = this.createNewPrevChat("Bard");
    }

    await redis.set(
      `CHATGPT:BARD_CHATS:${this.sender.user_id}`,
      JSON.stringify(prevChat)
    );

    return prevChat;
  };

  /**
   * @deprecated
   * @returns
   */
  gptGetOrCreatePrevChat = async () => {
    let prevChat = await redis.get(`CHATGPT:CHATS:${this.sender.user_id}`);
    if (!prevChat) {
      logger.info(
        `No previous chats of ${this.sender.nickname}[${this.sender.user_id}]`
      );
      prevChat = this.createNewPrevChat();
    } else {
      try {
        prevChat = await JSON.parse(prevChat);
      } catch (e) {
        logger.error(e);
        prevChat = this.createNewPrevChat();
      }
    }

    const timeElapsed = Math.abs(prevChat.ctime - Date.now()) / 1000;
    const timeOut = 600;
    if (timeElapsed > timeOut) {
      logger.info(`Chat timeout: ${timeElapsed} seconds passed.`);
      prevChat = this.createNewPrevChat();
    }

    await redis.set(
      `CHATGPT:CHATS:${this.sender.user_id}`,
      JSON.stringify(prevChat)
    );

    return prevChat;
  };

  /**
   * @deprecated
   * @param {*} model
   * @returns
   */
  async getOrCreatePrevChat(model = "ChatGPT") {
    if (model == "Bard") {
      const prevChat = await this.bardGetOrCreatePrevChat();
      return prevChat;
    } else {
      const prevChat = await this.gptGetOrCreatePrevChat();
      return prevChat;
    }
  }

  /**
   * @deprecated
   * @param {string} model model name, ChatGPT or Bard
   * @returns new PrevChat Object
   */
  createNewPrevChat = (model = "ChatGPT") => {
    const ctime = new Date();
    return {
      sender: this.sender,
      count: 0,
      ctime: ctime,
      utime: ctime,
      conversationId: model == "Bard" ? this.sender.user_id : undefined,
      parentMessageId: undefined,
    };
  };
}
