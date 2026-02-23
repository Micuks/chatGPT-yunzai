import Response from './question/Response.js'
import { getProvider } from './providers/index.js'
import { isBlocked } from './utils.js'

/**
 * @param {import('./question.js').default} questionInstance
 * @param {object} cfg
 * @returns {Promise<Response>}
 */
export const askAndReply = async (questionInstance, cfg = {}) => {
  await questionInstance.refreshMetaInfo()

  const provider = getProvider(questionInstance.questionType)
  const result = await provider.ask(questionInstance, cfg)
  const response =
    result instanceof Response
      ? result
      : new Response(String(result || ''), undefined, undefined)

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
