import { deprecate } from "util";
import russianJoke from "./russianJoke";

export default class Question {
  constructor(msg, questionType = undefined, e) {
    this.e = e;
    this.sender = e.sender;
    this.msg = msg;
    // Get questionBody and questionType{ChatGPT, Bard}
    this.parserQuestion();
    this.metaInfo = this.getMetaInfo();

    // Deprecated
    this.prevChat = undefined;
  }

  questionType = {
    ChatGPT: "ChatGPT",
    Bard: "Bard",
  };

  parseQuestion = () => {
    let gptReg = /^(\?|!|4|\/gpt4|gpt4|gpt|\/gpt)(.*)$/;
    let bardReg = /^(B|bard|\/bard)(.*)$/;

    let msg = this.e.msg;

    let questionBody = "";
    let questionType = this.questionType.ChatGPT;

    if (gptReg.test(msg)) {
      questionBody = gptReg.exec(msg)[2];
      questionType = this.questionType.ChatGPT;
    } else if (bardReg.test(msg)) {
      questionBody = bardReg.exec(msg)[2];
      questionType = this.questionType.Bard;
    } else {
      questionBody = russianJoke.russianJokePrompt;
    }

    this.questionBody = questionBody;
    this.questionType = questionType;
  };

  getMetaInfo = () => {
    let metaInfo = redis.get(`CHATGPT:${this.sender.user_id}`);
    if (!metaInfo) {
      metaInfo = this.newMetaInfo();
    }
    try {
      metaInfo = JSON.parse(metaInfo);
    } catch (err) {
      metaInfo = this.newMetaInfo();
    }

    return metaInfo;
  };

  setMetaInfo = (metaInfo) => {
    try {
      redis.set(`CHATGPT:${this.sender.user_id}`, JSON.stringify(metaInfo));
    } catch (err) {
      console.error(
        `Failed to set Meta Info for user ${this.sender.user_id}: ${err}`
      );
      return false;
    }

    return true;
  };

  newMetaInfo = () => {
    let ctime = new Date();
    return {
      bardInfo: {
        ctime: ctime,
        utime: ctime,
        sender: this.sender,
        parentMessageId: undefined,
        conversationId: this.sender.user_id,
      },
      chatGptInfo: {
        ctime: ctime,
        utime: ctime,
        sender: this.sender,
        parentMessageId: undefined,
        conversationId: this.sender.user_id,
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
