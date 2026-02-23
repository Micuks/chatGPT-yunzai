import { Config } from '../../config/config.js'
import ChatGptApi from '../models/chatgpt.js'
import OpenClawApi from '../models/openclaw.js'
import QuestionType from '../question/QuestionType.js'
import Response from '../question/Response.js'

const chatGptApi = new ChatGptApi()
const openClawApi = new OpenClawApi()

const buildOpenClawProvider = () => ({
  type: QuestionType.OpenClaw,
  ask: async (questionInstance) => {
    const questionBody = questionInstance.questionBody
    const metaInfo = questionInstance.metaInfo?.openClawInfo || {}
    const sessionKey =
      metaInfo.sessionKey || `yunzai:qq:${questionInstance.sender.user_id}`

    return openClawApi.ask(questionBody, { sessionKey })
  }
})

const buildChatGptProvider = () => ({
  type: QuestionType.ChatGPT,
  ask: async (questionInstance) => {
    if (!Config.legacyChatGptEnabled) {
      return new Response(
        'Legacy ChatGPT fallback is disabled by admin. 管理员已关闭 legacy ChatGPT 回退通道。',
        undefined,
        undefined
      )
    }

    const questionBody = questionInstance.questionBody
    const metaInfo = questionInstance.metaInfo?.chatGptInfo || {}
    const params = {
      systemMessage: `You are ChatGPT, a large language model trained by OpenAI. Current date: ${new Date().toISOString()}. Your answer should be in Chinese by default.`,
      conversationId: metaInfo.conversationId,
      parentMessageId: metaInfo.parentMessageId,
      model: Config.chatGptModel || 'gpt-3.5-turbo'
    }
    return chatGptApi.ask(questionBody, params)
  }
})

const providers = new Map()
providers.set(QuestionType.OpenClaw, buildOpenClawProvider())
providers.set(QuestionType.ChatGPT, buildChatGptProvider())

export const getProvider = (questionType) =>
  providers.get(questionType) || providers.get(QuestionType.OpenClaw)
