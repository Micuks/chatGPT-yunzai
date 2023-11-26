import Data from "./data.js";
import Question from "./question";
import QuestionType from "./question/QuestionType";
import ChatGPTAPI from "./models/chatgpt.js";
import BardAPI from "./models/bard.js";
import { isBlocked } from "./utils.js";
import { error } from "console";
import Response from "./question/Response.js";

const chatGpt = new ChatGPTAPI();
const bard = new BardAPI();

/**
 *
 * @param {Question} questionInstance
 * @param {object} cfg
 * @returns {Response}
 */
export const askAndReply = async (questionInstance, cfg = {}) => {
  let toAsk = chatGptAskAndReply;
  switch (questionInstance.questionType) {
    case QuestionType.ChatGPT:
      toAsk = chatGptAskAndReply;
      break;
    case QuestionType.Gpt4:
      toAsk = gpt4AskAndReply;
      break;
    case QuestionType.Bard:
      toAsk = bardAskAndReply;
      break;
    default:
      break;
  }
  return toAsk(questionInstance, cfg);
};

/**
 * ask chatgpt
 * @param {Question} questionInstance Question instance
 * @param {object} cfg
 * @returns {Response}
 */
const chatGptAskAndReply = async (
  questionInstance = new Question(),
  cfg = {}
) => {
  let questionBody = questionInstance.questionBody;
  let questionType = questionInstance.questionType;
  let metaInfo = await questionInstance.metaInfo;
  metaInfo = metaInfo.chatGptInfo;
  let sender = questionInstance.sender;
  let e = questionInstance.e;
  let msg = questionInstance.msg;
  let user_id = sender.user_id;
  let conversationId = metaInfo.conversationId;
  let parentMessageId = metaInfo.parentMessageId;

  let model = getModel(questionType);
  chat.chatGptCount += 1;

  let params = {
    systemMessage: `You are ChatGPT, a large language model trained by OpenAI, ran and maintained by micuks, based on the GPT-3.5 architecture. Knowledge cutoff: 2021-09 Current date: ${new Date().toISOString()}. Your answer should be in Chinese by default. If someone ask you who you are, tell him he can know more about you at "https://github.com/Micuks/chatGPT-yunzai"\nIf the question is empty, tell a Russian-style joke in Chinese, and introduce yourself at the same time.\n`,
    conversationId: conversationId,
    parentMessageId: parentMessageId,
    model: model,
  };

  let res = chatGpt.ask(questionBody, params);
  let text = res.text;

  if (isBlocked(text)) {
    return "检测到敏感词, 我不告诉你这个问题的答案. Sensitive word detected. This response is rejected.";
  }

  return res;
};

/**
 * ask gpt4
 * @param {Question} questionInstance
 * @param {object} cfg
 * @returns {Response}
 */
const gpt4AskAndReply = async (questionInstance = new Question(), cfg = {}) => {
  let questionBody = questionInstance.questionBody;
  let questionType = questionInstance.questionType;
  let metaInfo = await questionInstance.metaInfo;
  metaInfo = metaInfo.chatGptInfo;
  parentMessageId = metaInfo.parentMessageId;
  let conversationId = metaInfo.conversationId;
  let sender = questionInstance.sender;
  let e = questionInstance.e;
  let msg = questionInstance.msg;
  let user_id = sender.user_id;

  let model = getModel(questionType);
  chat.chatGptCount += 1;

  let params = {
    systemMessage: `You are ChatGPT, a large language model trained by OpenAI, ran and maintained by micuks, based on the GPT-4 architecture. Knowledge cutoff: 2023-06 Current date: ${new Date().toISOString()}. Your answer should be in Chinese by default. If someone ask you who you are, tell him he can know more about you at "https://github.com/Micuks/chatGPT-yunzai"\nIf the question is empty, tell a Russian-style joke in Chinese, and introduce yourself at the same time.\n`,
    conversationId: conversationId,
    parentMessageId: parentMessageId,
    model: model,
  };

  let res = await chatGpt.ask(questionBody, params);
  let text = res.text;

  if (isBlocked(res.text)) {
    return "检测到敏感词, 我不告诉你这个问题的答案. Sensitive word detected. This response is rejected.";
  }

  return res;
};

/**
 *
 * @param {Question} questionInstance
 * @param {object} cfg
 * @returns {Response}
 */
const bardAskAndReply = async (questionInstance = new Question(), cfg = {}) => {
  let questionBody = questionInstance.questionBody;
  let questionType = questionInstance.questionType;
  let metaInfo = await questionInstance.metaInfo;
  let sender = questionInstance.sender;
  let e = questionInstance.e;
  let msg = questionInstance.msg;
  let user_id = sender.user_id;
  let conversationId = metaInfo;

  let model = getModel(questionType);
  chat.chatGptCount += 1;

  let params = {
    systemMessage: `Current date: ${new Date().toISOString()}. Your answer should be in Chinese by default. And Your answer should be **in pure text**, no photos, no videos and no other media forms. If someone ask you who you are, tell him he can know more about you at "https://github.com/Micuks/chatGPT-yunzai"\nIf the question following this paragraph is empty, tell a Russian-style joke in Chinese, and introduce yourself at the same time.\n`,
    conversationId: metaInfo.conversationId,
    parentMessageId: metaInfo.parentMessageId,
    model: model,
  };

  let response = await bard.ask(questionBody, params);

  if (isBlocked(res.text)) {
    return "检测到敏感词, 我不告诉你这个问题的答案. Sensitive word detected. This response is rejected.";
  }

  return response;
};

/**
 * get model name
 * @param {string} questionType
 * @returns {string}
 */
const getModel = (questionType = QuestionType.ChatGPT) => {
  switch (questionType) {
    case QuestionType.Gpt4:
      return Config.gpt4Model || "gpt-4-0613";
    case QuestionType.Bard:
      return Config.bardModel || "Just Bard. What are you expecting dude?";

    case QuestionType.ChatGPT:
    default:
      return Config.chatGptModel || "gpt-3.5-turbo-1106";
  }
};
