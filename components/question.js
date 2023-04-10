export default class Question {
  constructor(question, sender) {
    this.question = question;
    this.sender = sender;
    this.prevChat = undefined;
  }

  bardGetOrCreatePrevChat = async () => {
    let prevChat = await redis.get(`CHATGPT:BARD_CHATS:${this.sender.user_id}`);
    if (!prevChat) {
      logger.info(
        `No previous bard chat for ${this.sender.nickname}[${this.sender.user_id}]`,
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
        `Your chat expired: ${timeElapsed} seconds passed after your last active time.`,
      );
      prevChat = this.createNewPrevChat("Bard");
    }

    await redis.set(
      `CHATGPT:BARD_CHATS:${this.sender.user_id}`,
      JSON.stringify(prevChat),
    );

    return prevChat;
  };

  gptGetOrCreatePrevChat = async () => {
    let prevChat = await redis.get(`CHATGPT:CHATS:${this.sender.user_id}`);
    if (!prevChat) {
      logger.info(
        `No previous chats of ${this.sender.nickname}[${this.sender.user_id}]`,
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
      JSON.stringify(prevChat),
    );
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

  createNewPrevChat = (model = "ChatGPT") => {
    const ctime = new Date();
    return {
      sender: this.sender,
      count: 0,
      ctime: ctime,
      utime: ctime,
      conversationId: (model == "Bard") ? this.sender.user_id : undefined,
      parentMessageId: undefined,
    };
  };
}
