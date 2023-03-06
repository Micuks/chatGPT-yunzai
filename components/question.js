export default class Question {
  constructor(question, sender) {
    this.question = question;
    this.sender = sender;
  }

  async getOrCreatePrevChat() {
    let prevChat = await redis.get(`CHATGPT:CHATS:${this.sender.user_id}`);
    if (!prevChat) {
      logger.info(
        `No previous chats of ${question.sender.username}[${question.sender.user_id}]`
      );
      prevChat = this.createNewPrevChat();
    } else {
      console.log("prevChat exists.");
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
    console.log(prevChat);
    return prevChat;
  }


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
