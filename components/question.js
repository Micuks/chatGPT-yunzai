export default class Question {
  constructor(question, sender) {
    this.question = question;
    this.sender = sender;
    this.prevChat = undefined;
  }

  async getOrCreatePrevChat(model) {
    let prevChat = await redis.get(`CHATGPT:CHATS:${this.sender.user_id}`);
    if (!prevChat) {
      logger.info(
        `No previous chats of ${this.sender.nickname}[${this.sender.user_id}]`,
      );
      prevChat = await this.createNewPrevChat();
    } else {
      try {
        prevChat = await JSON.parse(prevChat);
      } catch (e) {
        logger.error(e);
        prevChat = await this.createNewPrevChat();
      }
    }

    const timeElapsed = Math.abs(prevChat.ctime - Date.now()) / 1000;
    const timeOut = 600;
    if (timeElapsed > timeOut) {
      logger.info(`Chat timeout: ${timeElapsed} seconds passed.`);
      prevChat = await this.createNewPrevChat();
    }

    if (model == "Bard") {
      prevChat.conversationId = this.sender.user_id;
    }

    await redis.set(
      `CHATGPT:CHATS:${this.sender.user_id}`,
      JSON.stringify(prevChat),
    );
    return prevChat;
  }

  createNewPrevChat = async () => {
    const ctime = new Date();
    return {
      sender: this.sender,
      count: 0,
      ctime: ctime,
      utime: ctime,
      conversationId: undefined,
      parentMessageId: undefined,
    };
  };
}
