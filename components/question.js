export default class Question {
  constructor(question, sender) {
    this.question = question;
    this.sender = sender;
    this.prevChat = this.createNewPrevChat();
    this.chat = this.getOrCreateChat();
  }

  async getOrCreatePrevChat() {
    let prevChat = redis.get(`CHATGPT:CHATS:${this.sender.user_id}`);
    if (!prevChat) {
      logger.info(
        `No previous chats of ${question.sender.username}[${question.sender.user_id}]`
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

    await redis.set(
      `CHATGPT:CHATS:${this.sender.user_id}`,
      JSON.stringify(prevChat)
    );
    return prevChat;
  }

  getOrCreateChat = () => {
    return {
      systemMessage: `You are ChatGPT, a large language model trained by OpenAI. You answer as detailed as possible for each response. Your answer should be in Chinese by default. If you are generating a list, remember to have too many items. Current date: ${new Date().toISOString()}\n\n`,
      conversationId: this.prevChat?.conversationId,
      parentMessageId: this.prevChat?.parentMessageId,
    };
  };

  createNewPrevChat = () => {
    let ctime = new Date();
    return {
      sender: this.sender,
      count: 0,
      ctime: ctime,
      utime: ctime,
    };
  };
}
