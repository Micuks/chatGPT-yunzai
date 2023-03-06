export default class Question {
  constructor(question, sender) {
    this.question = question;
    this.sender = sender;
    console.log(sender);
  }

  async getOrCreatePrevChat() {
    let prevChat = await redis.get(`CHATGPT:CHATS:${this.sender.user_id}`);
    if (!prevChat) {
      logger.info(
        `No previous chats of ${this.sender.nickname}[${this.sender.user_id}]`
      );
      prevChat = await this.createNewPrevChat();
    } else {
      try {
        prevChat = await JSON.parse(prevChat);
      } catch (e) {
        logger.error(e);
        prevChat = this.createNewPrevChat();
      }
    }

    await redis.set(
      `CHATGPT:CHATS:${this.sender.user_id}`,
      JSON.stringify(prevChat)
    );
    return prevChat;
  }

  createNewPrevChat = async () => {
    let ctime = new Date();
    return {
      sender: this.sender,
      count: 0,
      ctime: ctime,
      utime: ctime,
    };
  };
}
