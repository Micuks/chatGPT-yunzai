import plugin from "../../../lib/plugins/plugin.js";
import { Queue } from "bull";
import { isChatExpired, isBlocked } from "./utils";
import Question from "./question";
import { ChatGPTAPI } from "chatgpt";
import chatGPTAPI from "./chat";

class QuestionQueue {
  constructor(yunzai) {
    this.queue = new Queue("questionQueue");
    this.yunzai = yunzai;
  }
  enQueue = async (question) => {
    await this.queue.add(question);
  };

  controller = async () => {
    const queuedJobs = await this.queue.getJobs(["waiting", "delayed"]);
    const jobsToRemove = queuedJobs.filter((queuedJob) =>
      isChatExpired(queuedJob.data.prevChat.utime)
    );
    await Promise.all(jobsToRemove.map((job) => this.removeExpiredChat(job)));

    await Promise.all(queuedJobs.map((job) => ask(job)));
  };

  ask = async (job) => {
    const question = job.data.question;
    const chat = job.data.chat;
    try {
      const res = await chatGPTAPI.sendMessage(question, chat);
      logger.info(`Get response text: ${res.text}`);

      if (isBlocked(res.text)) {
        await this.yunzai.reply("Sensitive word in response.", true);
        return;
      }

      updateChat(res, job);
    } catch (e) {
      logger.error(e);
      await this.yunzai.reply(
        `An error occurred while answering this question. please again try later.\n` +
          `${e.message.slice(0, 50)}\n`,
        true
      );
      if (e.message.includes("conversationId")) {
        this.removeExpiredChat(job);
      }
    }
  };

  updateChat = async (res, job) => {
    let chat = {
      conversationId: res.conversationId,
      parentMessageId: res.id,
    };
    let prevChat = {
      chat: chat,
      utime: new Date(),
      ctime: job.data.prevChat.ctime,
      count: job.data.prevChat.count + 1,
    };
    this.yunzai.redis.set(
      `CHATGPT:CHATS:${e.sender.user_id}`,
      JSON.stringify(prevChat)
    );
  };

  getUserSetting = async () => {
    let userSetting = await this.yunzai.redis.get(
      `CHATGPT:USER:${e.sender.user_id}`
    );
    if (userSetting) {
      userSetting = JSON.parse(userSetting);
    } else {
      userSetting = {
        usePicture: false,
      };
    }
    if (userSetting.usePicture) {
      // TODO
    } else {
      await this.yunzai.reply(`${res.text}`, e.isGroup);
    }
  };

  removeExpiredChat = async (expiredChat) => {
    logger.info(`${expiredChat.data.prevChat.sender}'s chat expired.`);
    expiredChat.remove();
  };
}
