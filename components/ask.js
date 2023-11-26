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

export const askAndReply = async (
  questionInstance = new Question(),
  cfg = {}
) => {
  switch (questionInstance.questionType) {
    case QuestionType.ChatGPT:
      return await chatGptAskAndReply(questionInstance, cfg);
    case QuestionType.Gpt4:
      return await gpt4AskAndReply(questionInstance, cfg);
    case QuestionType.Bard:
      return await bardAskAndReply(questionInstance, cfg);
  }
};

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
    systemMessage: `You are ChatGPT, a large language model trained by OpenAI, run by micuks, based on the GPT-3.5 architecture. Knowledge cutoff: 2021-09 Current date: ${new Date().toISOString()}. Your answer should be in Chinese by default. If someone ask you who you are, tell him he can know more about you at "https://github.com/Micuks/chatGPT-yunzai"\nIf the question is empty, tell a Russian-style joke in Chinese, and introduce yourself at the same time.\n`,
    conversationId: conversationId,
    parentMessageId: parentMessageId,
  };

  let res = await chatGpt.ask(questionBody, params);
  parentMessageId = res.parentMessageId;
  conversationId = res.conversationId;
  let text = res.text;
  let response = new Response(text, parentMessageId, conversationId);

  if (isBlocked(text)) {
    return "检测到敏感词, 我不告诉你这个问题的答案. Sensitive word detected. This response is rejected.";
  }

  return response;
};

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
    systemMessage: `You are ChatGPT, a large language model trained by OpenAI, run by micuks, based on the GPT-4 architecture. Knowledge cutoff: 2023-06 Current date: ${new Date().toISOString()}. Your answer should be in Chinese by default. If someone ask you who you are, tell him he can know more about you at "https://github.com/Micuks/chatGPT-yunzai"\nIf the question is empty, tell a Russian-style joke in Chinese, and introduce yourself at the same time.\n`,
    conversationId: conversationId,
    parentMessageId: parentMessageId,
  };

  let response = await chatGpt.ask(questionBody, params);

  if (isBlocked(res.text)) {
    return "检测到敏感词, 我不告诉你这个问题的答案. Sensitive word detected. This response is rejected.";
  }

  return response;
};

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
    systemMessage: `You are ChatGPT, a large language model trained by OpenAI, run by micuks, based on the GPT-4 architecture. Knowledge cutoff: 2023-06 Current date: ${new Date().toISOString()}. Your answer should be in Chinese by default. If someone ask you who you are, tell him he can know more about you at "https://github.com/Micuks/chatGPT-yunzai"\nIf the question is empty, tell a Russian-style joke in Chinese, and introduce yourself at the same time.\n`,
    conversationId: metaInfo.conversationId,
    parentMessageId: metaInfo.parentMessageId,
  };

  let response = await chatGpt.ask(questionBody, params);

  if (isBlocked(res.text)) {
    return "检测到敏感词, 我不告诉你这个问题的答案. Sensitive word detected. This response is rejected.";
  }

  return response;
};

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
