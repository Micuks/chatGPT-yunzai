
class Question {
  constructor(e, question) {
    this.e = e;
    this.question = question;
    logger.info(e);
    logger.info(question);
  }

  getChatParams = async () => {
    this.prevChat = await redis.get(`CHATGPT:CHATS:${this.e.sender.user_id}`);

    this.chat = {};

    if (!this.prevChat) {
      logger.info(
        `No previous chats of ${this.e.sender.username}[${this.e.sender.user_id}]`
      );
      this.prevChat = this.createNewPrevChat();
    } else {
      this.prevChat = JSON.parse(this.prevChat);
      this.chat = {
        systemMessage: `You are ChatGPT, a large language model trained by OpenAI. You answer as detailed as possible for each response. Your answer should be in Chinese by default. If you are generating a list, remember to have too many items. Current date: ${new Date().toISOString()}\n\n`,
        conversationId: this.prevChat?.conversationId,
        parentMessageId: this.prevChat?.parentMessageId,
      };
    }
  };

  createNewPrevChat = async () => {
    let ctime = new Date();
    return {
      sender: this.e.sender,
      count: 0,
      ctime: ctime,
      utime: utime,
    };
  };
}