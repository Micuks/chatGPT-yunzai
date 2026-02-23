import fetch from 'node-fetch'
import { Config } from '../../config/config.js'
import Response from '../question/Response.js'

const COMPLETED_STATUS = new Set(['done', 'completed', 'success', 'finished'])
const PROCESSING_STATUS = new Set([
  'queued',
  'pending',
  'running',
  'processing',
  'started',
  'tooluse'
])
const ERROR_STATUS = new Set(['error', 'failed', 'fail'])

const delay = async (ms) =>
  new Promise((resolve) => setTimeout(resolve, Number(ms) || 0))

class OpenClawApi {
  constructor () {
    this.baseUrl = (Config.openClawBaseUrl || '').replace(/\/$/, '')
  }

  buildAuthHeaders () {
    const token = Config.openClawToken
    const authType = (Config.openClawAuthType || 'bearer').toLowerCase()
    if (!token || authType === 'none') {
      return {}
    }

    if (authType === 'header') {
      const key = Config.openClawAuthHeader || 'x-openclaw-token'
      return { [key]: token }
    }

    return { Authorization: `Bearer ${token}` }
  }

  buildUrl (path = '') {
    if (!path.startsWith('/')) {
      path = `/${path}`
    }
    return `${this.baseUrl}${path}`
  }

  buildSessionUrl (sessionKey) {
    const mode = (Config.openClawSessionMode || 'query').toLowerCase()
    const path = Config.openClawSessionPath || '/sessions'
    const url = this.buildUrl(path)
    if (mode === 'path') {
      return `${url}/${encodeURIComponent(sessionKey)}`
    }
    const queryKey = Config.openClawSessionQueryKey || 'sessionKey'
    return `${url}?${encodeURIComponent(queryKey)}=${encodeURIComponent(sessionKey)}`
  }

  normalizeStopReason (value) {
    return String(value || '')
      .trim()
      .toLowerCase()
  }

  toTextFromContentBlock (block) {
    if (!block) return ''
    if (typeof block === 'string') return block
    if (block.type === 'text' && typeof block.text === 'string') {
      return block.text
    }
    if (typeof block.content === 'string') {
      return block.content
    }
    return ''
  }

  contentToText (content) {
    if (!content) return ''
    if (typeof content === 'string') return content.trim()
    if (!Array.isArray(content)) return ''

    const text = content
      .map((block) => this.toTextFromContentBlock(block))
      .filter((item) => typeof item === 'string' && item.trim())
      .join('\n')
      .trim()
    return text
  }

  pickSessionFromList (sessions = [], sessionKey = '') {
    if (!Array.isArray(sessions) || sessions.length === 0) {
      return null
    }

    const exact = sessions.find((item) => item?.key === sessionKey)
    if (exact) return exact

    const fuzzy = sessions.find((item) =>
      String(item?.key || '').includes(sessionKey)
    )
    if (fuzzy) return fuzzy

    return sessions
      .slice()
      .sort((a, b) => Number(b?.updatedAt || 0) - Number(a?.updatedAt || 0))[0]
  }

  getMessagesFromPayload (payload, sessionKey = '') {
    if (!payload || typeof payload !== 'object') {
      return []
    }

    if (Array.isArray(payload.messages)) {
      return payload.messages
    }
    if (Array.isArray(payload.data?.messages)) {
      return payload.data.messages
    }

    if (Array.isArray(payload.sessions)) {
      const selected = this.pickSessionFromList(payload.sessions, sessionKey)
      if (selected && Array.isArray(selected.messages)) {
        return selected.messages
      }
    }

    return []
  }

  findLatestAssistantMessage (messages = [], opts = {}) {
    const { completedOnly = true } = opts
    if (!Array.isArray(messages) || messages.length === 0) {
      return null
    }

    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]
      if (!msg || String(msg.role || '').toLowerCase() !== 'assistant') {
        continue
      }

      const stopReason = this.normalizeStopReason(msg.stopReason)
      if (completedOnly && stopReason && stopReason !== 'stop') {
        continue
      }

      const text = this.contentToText(msg.content)
      if (!text) {
        continue
      }

      return {
        text,
        stopReason,
        timestamp: Number(msg.timestamp || 0)
      }
    }

    return null
  }

  hasNewAssistantReply (latest, previous = null) {
    if (!latest || !latest.text) return false
    if (!previous) return true

    if (latest.timestamp && previous.timestamp) {
      return latest.timestamp > previous.timestamp
    }
    return latest.text !== previous.text
  }

  getPayloadStatus (payload) {
    if (!payload || typeof payload !== 'object') return ''
    return String(payload.status || payload.state || payload.data?.status || '')
      .trim()
      .toLowerCase()
  }

  async parseJsonSafe (res) {
    const raw = await res.text()
    if (!raw) return {}
    try {
      return JSON.parse(raw)
    } catch (err) {
      return { raw }
    }
  }

  async submitMessage (message, sessionKey) {
    const retries = Number(Config.openClawSubmitRetries || 2)
    const retryDelayMs = Number(Config.openClawRetryDelayMs || 500)
    const url = this.buildUrl(Config.openClawAgentHookPath || '/hooks/agent')
    const headers = {
      'Content-Type': 'application/json',
      ...this.buildAuthHeaders()
    }

    const payload = {
      message,
      sessionKey,
      wakeMode: Config.openClawWakeMode || 'now',
      deliver: Boolean(Config.openClawDeliver)
    }

    if (payload.deliver) {
      if (Config.openClawDeliverChannel) payload.channel = Config.openClawDeliverChannel
      if (Config.openClawDeliverTo) payload.to = Config.openClawDeliverTo
    }

    let lastErr
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        })
        if (res.status === 202 || res.status === 200) {
          return true
        }
        const responseText = await res.text()
        throw new Error(`OpenClaw submit failed with status ${res.status}: ${responseText}`)
      } catch (err) {
        lastErr = err
        if (attempt < retries) {
          await delay(retryDelayMs)
          continue
        }
      }
    }

    throw lastErr || new Error('OpenClaw submit failed')
  }

  async fetchSession (sessionKey) {
    const url = this.buildSessionUrl(sessionKey)
    const headers = this.buildAuthHeaders()
    const res = await fetch(url, { method: 'GET', headers })
    if (res.status === 404 || res.status === 204) {
      return {}
    }
    if (!res.ok) {
      const responseText = await res.text()
      throw new Error(`OpenClaw session query failed with status ${res.status}: ${responseText}`)
    }
    return this.parseJsonSafe(res)
  }

  async getLatestAssistantReply (sessionKey) {
    try {
      const payload = await this.fetchSession(sessionKey)
      const messages = this.getMessagesFromPayload(payload, sessionKey)
      return this.findLatestAssistantMessage(messages, { completedOnly: true })
    } catch (err) {
      return null
    }
  }

  async pollAssistantReply (sessionKey, previousReply = null) {
    const pollIntervalMs = Number(Config.openClawPollIntervalMs || 1000)
    const pollTimeoutMs = Number(Config.openClawPollTimeoutMs || 120000)
    const start = Date.now()

    while (Date.now() - start <= pollTimeoutMs) {
      const payload = await this.fetchSession(sessionKey)
      const status = this.getPayloadStatus(payload)
      const messages = this.getMessagesFromPayload(payload, sessionKey)

      const latestCompleted = this.findLatestAssistantMessage(messages, {
        completedOnly: true
      })
      if (this.hasNewAssistantReply(latestCompleted, previousReply)) {
        return latestCompleted.text
      }

      const latestAssistant = this.findLatestAssistantMessage(messages, {
        completedOnly: false
      })
      const stopReason = this.normalizeStopReason(latestAssistant?.stopReason)

      if (stopReason === 'error' || (status && ERROR_STATUS.has(status))) {
        throw new Error(`OpenClaw assistant returned error state for ${sessionKey}`)
      }

      if (
        latestCompleted &&
        (COMPLETED_STATUS.has(status) || stopReason === 'stop')
      ) {
        return latestCompleted.text
      }

      if (
        status &&
        !PROCESSING_STATUS.has(status) &&
        !COMPLETED_STATUS.has(status) &&
        !ERROR_STATUS.has(status) &&
        latestCompleted
      ) {
        return latestCompleted.text
      }

      await delay(pollIntervalMs)
    }

    throw new Error(
      `OpenClaw polling timed out after ${pollTimeoutMs}ms for session ${sessionKey}`
    )
  }

  async ask (questionBody, params = {}) {
    const sessionKey = params.sessionKey
    if (!Config.useOpenClaw) {
      return new Response(
        'OpenClaw provider is disabled by admin. 管理员已关闭 OpenClaw。',
        undefined,
        sessionKey,
        { sessionKey }
      )
    }
    if (!sessionKey) {
      throw new Error('OpenClaw ask requires sessionKey')
    }

    const previousReply = await this.getLatestAssistantReply(sessionKey)
    await this.submitMessage(questionBody, sessionKey)

    if (Config.openClawDeliver) {
      return new Response(
        '消息已提交到 OpenClaw 渠道，请在目标渠道查看回复。',
        undefined,
        sessionKey,
        { sessionKey, delivered: true }
      )
    }

    const text = await this.pollAssistantReply(sessionKey, previousReply)
    return new Response(text, undefined, sessionKey, { sessionKey })
  }
}

export default OpenClawApi
