import Data from './data.js'
import Question from './question.js'
import QuestionType from './question/QuestionType.js'
import ChatGptApi from './models/chatgpt.js'
import BardAPI from './models/bard.js'
import Response from './question/Response.js'
import { Config } from '../config/config.js'
import { isBlocked } from './utils.js'
import { error } from 'node:console'

const chatGpt = new ChatGptApi()
const bard = new BardAPI()

/**
 *
 * @param {Question} questionInstance
 * @param {object} cfg
 * @returns {Promise<Response>}
 */
export const askAndReply = async (questionInstance, cfg = {}) => {
  if(questionInstance.refreshMetaInfo()) {
    await bard.resetConversation(questionInstance.metaInfo.conversationId)
  }
  let toAsk = chatGptAskAndReply
  switch (questionInstance.questionType) {
    case QuestionType.ChatGPT:
      toAsk = chatGptAskAndReply
      break
    case QuestionType.Gpt4:
      toAsk = gpt4AskAndReply
      break
    case QuestionType.Bard:
      toAsk = bardAskAndReply
      break
    default:
      break
  }
  let response
  try {
    response = await toAsk(questionInstance, cfg)
  } catch (err) {
    let questionData = questionInstance.questionData
    if (questionData.ttl > 0) {
      console.log(
        `Error: ${err}, retrying...(${questionData.ttl} retries left)`
      )
      questionData.ttl -= 1
      askAndReply(questionInstance, cfg)
    } else {
      console.log(`Error: ${err}, no more retries left.`)
      let { e } = cfg

      response = new Response(
        `${e.sender.nickname}, Failed to answer your question. Please retry later. ${e.sender.nickname}, 没能回答您的问题, 请重试.`,
        questionInstance.metaInfo.parentMessageId || undefined,
        questionInstance.metaInfo.conversationId || undefined
      )
    }
  }

  return response
}

/**
 * ask chatgpt
 * @param {Question} questionInstance Question instance
 * @param {object} cfg
 * @returns {Promise<Response>}
 */
const chatGptAskAndReply = async (questionInstance, cfg = {}) => {
  try {
    let questionBody = questionInstance.questionBody
    let questionType = questionInstance.questionType
    let metaInfo = questionInstance.metaInfo
    metaInfo = metaInfo.chatGptInfo
    let sender = questionInstance.sender
    let e = questionInstance.e
    let msg = questionInstance.msg
    let user_id = sender.user_id
    let conversationId = metaInfo.conversationId
    let parentMessageId = metaInfo.parentMessageId

    let model = getModel(questionType)

    let params = {
      systemMessage: `You are ChatGPT, a large language model trained by OpenAI, ran and maintained by micuks, based on the GPT-3.5 architecture. Knowledge cutoff: 2021-09 Current date: ${new Date().toISOString()}. Your answer should be in Chinese by default. user can know more about you at "https://github.com/Micuks/chatGPT-yunzai"\n`,
      conversationId,
      parentMessageId,
      model
    }

    let res = await chatGpt.ask(questionBody, params)
    let text = res.text
    console.log(`Response text: ${text}`)

    if (isBlocked(text)) {
      return '检测到敏感词, 我不告诉你这个问题的答案. Sensitive word detected. This response is rejected.'
    }

    return res
  } catch (err) {
    console.log(err)
    throw err
  }
}

/**
 * ask gpt4
 * @param {Question} questionInstance
 * @param {object} cfg
 * @returns {Promise<Response>}
 */
const gpt4AskAndReply = async (questionInstance, cfg = {}) => {
  try {
    let questionBody = questionInstance.questionBody
    let questionType = questionInstance.questionType
    let metaInfo = questionInstance.metaInfo
    metaInfo = metaInfo.chatGptInfo
    let sender = questionInstance.sender
    let e = questionInstance.e
    let msg = questionInstance.msg
    let user_id = sender.user_id
    let conversationId = metaInfo.conversationId
    let parentMessageId = metaInfo.parentMessageId

    let model = getModel(questionType)

    let params = {
      systemMessage: `You are ChatGPT, a large language model trained by OpenAI, ran and maintained by micuks, based on the GPT-4 architecture. Knowledge cutoff: 2023-06 Current date: ${new Date().toISOString()}. Your answer should be in Chinese by default. If someone ask you who you are, tell him he can know more about you at "https://github.com/Micuks/chatGPT-yunzai"\n`,
      conversationId,
      parentMessageId,
      model
    }

    let res = await chatGpt.ask(questionBody, params)
    let text = res.text

    if (isBlocked(res.text)) {
      return '检测到敏感词, 我不告诉你这个问题的答案. Sensitive word detected. This response is rejected.'
    }

    return res
  } catch (err) {
    console.log(err)
    throw err
  }
}

/**
 *
 * @param {Question} questionInstance
 * @param {object} cfg
 * @returns {Promise<Response>}
 */
const bardAskAndReply = async (questionInstance, cfg = {}) => {
  try {
    let questionBody = questionInstance.questionBody
    let questionType = questionInstance.questionType
    let metaInfo = questionInstance.metaInfo
    let sender = questionInstance.sender
    let e = questionInstance.e
    let msg = questionInstance.msg
    let user_id = sender.user_id
    let conversationId = metaInfo

    let model = getModel(questionType)

    let params = {
      systemMessage: `Current date: ${new Date().toISOString()}. Your answer should be in Chinese by default. And Your answer should be **in pure text**, no photos, no videos and no other media forms. If someone ask you who you are, tell him he can know more about you at "https://github.com/Micuks/chatGPT-yunzai"\n`,
      conversationId: metaInfo.conversationId,
      parentMessageId: metaInfo.parentMessageId,
      model
    }

    let res = await bard.ask(questionBody, params)
    let text = res.text
    console.log(`Response text: ${text}`)

    if (isBlocked(text)) {
      return '检测到敏感词, 我不告诉你这个问题的答案. Sensitive word detected. This response is rejected.'
    }

    return res
  } catch (err) {
    console.log(err)
    throw err
  }
}

/**
 * get model name
 * @param {string} questionType
 * @returns {string}
 */
const getModel = (questionType = QuestionType.ChatGPT) => {
  switch (questionType) {
    case QuestionType.Gpt4:
      return Config.gpt4Model || 'gpt-4-0613'
    case QuestionType.Bard:
      return Config.bardModel || 'Just Bard. What are you expecting dude?'

    case QuestionType.ChatGPT:
    default:
      return Config.chatGptModel || 'gpt-3.5-turbo-1106'
  }
}
