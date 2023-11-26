import { deprecate } from "util";
import russianJoke from "./russianJoke";
import { Config } from "../config/config";
import QuestionType from "./question/QuestionType";
import Data from "./data";

export default class Question {
  constructor(questionData, cfg) {
    const { e } = cfg;
    this.e = e;
    const { sender, msg, params } = questionData;
    this.sender = sender;
    this.msg = msg;
    this.params = params;

    // Get questionBody and questionType{ChatGPT, Bard}
    this.parserQuestion();
    this.metaInfo = this.getMetaInfo(); // WARN: this is a Promise
  }

  parseQuestion = () => {
    let gptReg = /^(\?|!|gpt|\/gpt)(.*)$/;
    let gpt4Reg = /^(4|\/gpt4|gpt4)(.*)$/;
    let bardReg = /^(B|bard|\/bard)(.*)$/;

    let msg = this.e.msg;

    let questionBody = "";
    let questionType = QuestionType.ChatGPT;

    if (gptReg.test(msg)) {
      questionBody = gptReg.exec(msg)[2];
      questionType = QuestionType.ChatGPT;
    } else if (gpt4Reg.test(msg)) {
      questionType = QuestionType.Gpt4;
      if (Config.useGpt4) {
        questionBody = gpt4Reg.exec(msg)[2];
      } else {
        questionBody = `My GPT-4 model is not enabled. Please contact my master if you have any question.`;
      }
    } else if (bardReg.test(msg)) {
      questionType = QuestionType.Bard;
      if (Config.useBard) {
        questionBody = bardReg.exec(msg)[2];
      } else {
        questionBody =
          "Bard is disabled. If you have any question, contact my master.";
      }
    } else {
      questionBody = russianJoke.russianJokePrompt;
    }

    this.questionBody = questionBody;
    this.questionType = questionType;
  };

  getMetaInfo = async () => {
    let metaInfo = await Data.getMetaInfo(this.sender.user_id);
    if (!metaInfo) {
      metaInfo = this.newMetaInfo();
    }
    try {
      metaInfo = JSON.parse(metaInfo);
    } catch (err) {
      metaInfo = this.newMetaInfo();
    }

    metaInfo = JSON.stringify(metaInfo);
    return metaInfo;
  };

  setMetaInfo = async (metaInfo) => {
    try {
      await Data.setMetaInfo(metaInfo);
    } catch (err) {
      console.log(
        `Failed to set Meta Info for user ${this.sender.user_id}: ${err}`
      );
      return false;
    }

    return true;
  };

  updateMetaInfo = async (parentMessageId, conversationId) => {
    let metaInfo = await this.metaInfo;
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

  @deprecate
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

  @deprecate
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
   *
   * @param {string} model model name, ChatGPT or Bard
   * @returns new PrevChat Object
   */
  @deprecate
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
