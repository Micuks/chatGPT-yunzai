import Response from './question/Response.js'
import BardAPI from './models/bard.js'
import OpenAIChatModel from './models/openai-chat.js'
import { isBlocked } from './utils.js'
const clientCache = new Map()

const getClient = (provider) => {
  if (!provider) return undefined
  if (clientCache.has(provider.key)) {
    return clientCache.get(provider.key)
  }

  let client
  switch ((provider.type || '').toLowerCase()) {
    case 'bard':
      client = new BardAPI(provider)
      break
    default:
      client = new OpenAIChatModel(provider)
      break
  }

  clientCache.set(provider.key, client)
  return client
}

/**
 *
 * @param {Question} questionInstance
 * @param {object} cfg
 * @returns {Promise<Response>}
 */
export const askAndReply = async (questionInstance, cfg = {}) => {
  const refreshed = await questionInstance.refreshMetaInfo()

  const provider = questionInstance.modelProfile
  if (!provider) {
    throw new Error('无法识别当前问题所需的模型。请检查触发指令配置。')
  }

  const client = getClient(provider)
  if (!client) {
    throw new Error(`模型 ${provider.name} 尚未正确配置或不受支持。`)
  }

  const session = questionInstance.getSession()

  let response
  try {
    if ((provider.type || '').toLowerCase() === 'bard') {
      if (refreshed && typeof client.resetConversation === 'function') {
        await client.resetConversation(session?.conversationId)
      }

      response = await client.ask(questionInstance.questionBody, {
        systemMessage:
          provider.systemMessage ||
          `Current date: ${new Date().toISOString()}. Your answer should be in Chinese by default.`,
        conversationId: session?.conversationId,
        parentMessageId: session?.parentMessageId
      })
    } else {
      response = await client.ask(questionInstance.questionBody, {
        question: questionInstance,
        session
      })
    }
  } catch (err) {
    const questionData = questionInstance.questionData
    if (questionData.ttl > 0) {
      console.log(`Error: ${err}, retrying...(${questionData.ttl} retries left)`)
      questionData.ttl -= 1
      return askAndReply(questionInstance, cfg)
    }

    console.log(`Error: ${err}, no more retries left.`)
    const { e } = cfg
    response = new Response(
      `${e.sender.nickname}, Failed to answer your question. Please retry later. ${e.sender.nickname}, 没能回答您的问题, 请重试.`,
      undefined,
      undefined
    )
  }

  if (isBlocked(response.text)) {
    return new Response(
      '检测到敏感词, 我不告诉你这个问题的答案. Sensitive word detected. This response is rejected.',
      response.parentMessageId,
      response.conversationId,
      response.params
    )
  }

  return response
}
