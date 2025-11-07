import { HttpsProxyAgent } from 'https-proxy-agent'

import { Config } from '../../config/runtime.js'
import Response from '../question/Response.js'

let cachedFetch = typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : null

const ensureFetch = async () => {
  if (cachedFetch) return cachedFetch

  const mod = await import('node-fetch')
  cachedFetch = (mod.default || mod).bind(mod)
  return cachedFetch
}

const getDefaultSystemMessage = (provider, context = {}) => {
  const now = new Date().toISOString()
  const baseName = provider?.name || 'ChatGPT'
  const nickname = context?.question?.sender?.nickname
  const user = nickname ? `${nickname}[${context?.question?.sender?.user_id}]` : 'the user'
  return `${baseName}, you are a large language model maintained by the bot owner. Answer in Chinese by default unless explicitly asked otherwise. Current date: ${now}. Provide concise, well-structured answers to ${user}.`
}

const ensureHeaders = (request = {}) => {
  const headers = { 'Content-Type': 'application/json', ...(request.headers || {}) }
  const apiKey = request.apiKey || Config.apiKey
  const authScheme = request.authScheme || request.authType || 'Bearer'

  if (apiKey && !headers.Authorization) {
    headers.Authorization = `${authScheme} ${apiKey}`.trim()
  }

  return headers
}

const buildUrl = (request = {}) => {
  if (request.url) {
    return request.url
  }

  const baseUrl = request.baseUrl || Config.apiBaseUrl || 'https://api.openai.com/v1'
  const path = request.path || '/chat/completions'
  return `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
}

const trimHistory = (history = [], limit = 6) => {
  if (!limit || limit <= 0) {
    return [...history]
  }
  const maxEntries = limit * 2
  if (history.length <= maxEntries) {
    return [...history]
  }

  return history.slice(-maxEntries)
}

const renderTemplate = (template, context = {}) => {
  if (!template || typeof template !== 'string') return template

  return template
    .replace(/\{\{\s*current_datetime\s*\}\}/gi, new Date().toISOString())
    .replace(
      /\{\{\s*user\.nickname\s*\}\}/gi,
      context?.question?.sender?.nickname || ''
    )
    .replace(
      /\{\{\s*user\.id\s*\}\}/gi,
      context?.question?.sender?.user_id ? `${context.question.sender.user_id}` : ''
    )
    .replace(/\{\{\s*bot\.id\s*\}\}/gi, `${context?.question?.e?.self_id || ''}`)
}

const safeJsonParse = async (response) => {
  try {
    const text = await response.text()
    try {
      return JSON.parse(text)
    } catch (err) {
      return { error: text }
    }
  } catch (err) {
    return { error: err.message }
  }
}

const buildAgent = (proxy) => {
  if (!proxy) return undefined

  try {
    return new HttpsProxyAgent(proxy)
  } catch (err) {
    console.error(`Failed to create proxy agent for ${proxy}: ${err}`)
    return undefined
  }
}

export default class OpenAIChatModel {
  constructor (provider) {
    this.provider = provider
  }

  async ask (questionBody, context = {}) {
    const session = context.session || {}
    const request = this.provider.request || {}
    const url = buildUrl(request)
    const headers = ensureHeaders(request)
    const messages = this.buildMessages(questionBody, context)
    const payload = {
      model: request.model || this.provider.model || 'gpt-3.5-turbo',
      messages,
      temperature: request.temperature ?? this.provider.temperature ?? 0.7,
      ...this.provider.payload,
      ...request.payload
    }

    if (request.max_tokens !== undefined) payload.max_tokens = request.max_tokens
    if (request.top_p !== undefined) payload.top_p = request.top_p
    if (request.frequency_penalty !== undefined) { payload.frequency_penalty = request.frequency_penalty }
    if (request.presence_penalty !== undefined) { payload.presence_penalty = request.presence_penalty }

    const fetchOptions = {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    }

    const proxy = request.proxy ?? Config.proxy
    const agent = buildAgent(proxy)
    if (agent) {
      fetchOptions.agent = agent
    }

    const timeout = request.timeout ?? Config.requestTimeout ?? 60000
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)
    fetchOptions.signal = controller.signal

    let response
    try {
      const fetchFn = await ensureFetch()
      response = await fetchFn(url, fetchOptions)
    } catch (err) {
      clearTimeout(timer)
      throw new Error(`Failed to request model "${this.provider.name}": ${err}`)
    }

    clearTimeout(timer)

    if (!response.ok) {
      const errPayload = await safeJsonParse(response)
      const detail = errPayload?.error ? JSON.stringify(errPayload.error) : ''
      throw new Error(
        `Model "${this.provider.name}" request failed with status ${response.status}. ${detail}`
      )
    }

    const data = await response.json()
    const choice = data?.choices?.[0]
    const text = choice?.message?.content?.trim()

    if (!text) {
      throw new Error(`Empty response returned by model "${this.provider.name}"`)
    }

    return new Response(text, data?.id || choice?.id || null, session?.conversationId, {
      raw: data
    })
  }

  buildMessages (questionBody, context = {}) {
    const session = context.session || {}
    const history = Array.isArray(session.history) ? session.history : []
    const maxHistory = this.provider.historySize ?? this.provider.maxHistory ?? 6
    const trimmedHistory = trimHistory(history, maxHistory)
    const messages = []
    const systemTemplate = this.provider.systemMessage || getDefaultSystemMessage(this.provider, context)
    if (systemTemplate) {
      messages.push({ role: 'system', content: renderTemplate(systemTemplate, context) })
    }

    trimmedHistory.forEach((item) => {
      if (!item || !item.role || !item.content) return
      const role = item.role
      const content = typeof item.content === 'string' ? item.content : ''
      if (!content.trim()) return
      messages.push({ role, content })
    })

    const question = typeof questionBody === 'string' ? questionBody.trim() : ''
    if (!question) {
      messages.push({ role: 'user', content: '请继续对话。' })
    } else {
      messages.push({ role: 'user', content: question })
    }

    return messages
  }
}

