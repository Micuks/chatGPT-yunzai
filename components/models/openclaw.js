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

  getTransportMode () {
    return String(Config.openClawTransport || 'auto')
      .trim()
      .toLowerCase()
  }

  buildWsUrlCandidates () {
    const explicit = String(Config.openClawWsUrl || '').trim()
    const base = explicit || this.baseUrl
    if (!base) return []

    const baseAsWs = base.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:')
    const fallbackPaths = String(Config.openClawWsPaths || '/')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)

    const candidates = new Set()
    candidates.add(baseAsWs)

    for (const path of fallbackPaths) {
      if (/^wss?:\/\//i.test(path)) {
        candidates.add(path)
        continue
      }
      const normalizedPath = path.startsWith('/') ? path : `/${path}`
      const root = baseAsWs.replace(/\/+$/, '')
      candidates.add(`${root}${normalizedPath}`)
    }

    return [...candidates]
  }

  parseCsv (value, fallback = []) {
    if (Array.isArray(value)) {
      return value.map((item) => String(item).trim()).filter(Boolean)
    }
    const text = String(value || '')
    const list = text
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
    if (list.length > 0) return list
    return fallback
  }

  buildIdempotencyKey (sessionKey = '') {
    const sid = String(sessionKey || 'main').replace(/[^a-zA-Z0-9_-]/g, '_')
    let rid = ''
    try {
      rid = typeof crypto?.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}_${Math.random().toString(16).slice(2)}`
    } catch (err) {
      rid = `${Date.now()}_${Math.random().toString(16).slice(2)}`
    }
    return `yunzai_${sid}_${rid}`
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

  extractRpcResult (message) {
    if (!message || typeof message !== 'object') return undefined
    if (Object.prototype.hasOwnProperty.call(message, 'result')) return message.result
    if (Object.prototype.hasOwnProperty.call(message, 'data')) return message.data
    return message
  }

  rpcErrorToString (errLike) {
    if (!errLike) return 'Unknown RPC error'
    if (typeof errLike === 'string') return errLike
    if (typeof errLike.message === 'string') return errLike.message
    if (typeof errLike.error === 'string') return errLike.error
    if (typeof errLike.code !== 'undefined' && typeof errLike.msg === 'string') {
      return `[${errLike.code}] ${errLike.msg}`
    }
    try {
      return JSON.stringify(errLike)
    } catch (err) {
      return String(errLike)
    }
  }

  extractResponseTextFromResult (result) {
    if (!result) return ''
    if (typeof result === 'string') return result.trim()
    if (typeof result?.text === 'string' && result.text.trim()) return result.text.trim()
    if (typeof result?.message === 'string' && result.message.trim()) return result.message.trim()
    if (typeof result?.output === 'string' && result.output.trim()) return result.output.trim()

    const messages = this.getMessagesFromPayload(result)
    const latest = this.findLatestAssistantMessage(messages, { completedOnly: true })
    if (latest?.text) return latest.text
    return ''
  }

  async connectWsClient () {
    const urls = this.buildWsUrlCandidates()
    if (urls.length === 0) {
      throw new Error('OpenClaw WS URL is empty')
    }

    const connectTimeoutMs = Number(Config.openClawWsConnectTimeoutMs || 5000)
    const useWsAuthHeader = Boolean(Config.openClawWsUseAuthHeader)
    const headers = useWsAuthHeader ? this.buildAuthHeaders() : {}
    let lastErr

    for (const url of urls) {
      try {
        const ws = await new Promise((resolve, reject) => {
          let socket
          let settled = false
          const onDone = (fn, value) => {
            if (settled) return
            settled = true
            clearTimeout(timer)
            fn(value)
          }
          const timer = setTimeout(() => {
            try {
              socket?.close()
            } catch (err) {}
            onDone(
              reject,
              new Error(`OpenClaw WS connect timeout: ${url}`)
            )
          }, connectTimeoutMs)

          try {
            const opts =
              Object.keys(headers).length > 0
                ? { headers }
                : undefined
            socket = opts
              ? new WebSocket(url, [], opts)
              : new WebSocket(url)
          } catch (err) {
            onDone(reject, err)
            return
          }

          socket.onopen = () => onDone(resolve, socket)
          socket.onerror = (event) => {
            const msg = event?.message || event?.error?.message || 'handshake failed'
            onDone(
              reject,
              new Error(`OpenClaw WS handshake failed (${url}): ${msg}`)
            )
          }
          socket.onclose = (event) => {
            if (settled) return
            onDone(
              reject,
              new Error(
                `OpenClaw WS closed before ready (${url}) code=${event?.code || 0}`
              )
            )
          }
        })

        return {
          url,
          ws,
          closed: false,
          pending: new Map(),
          nextId: 1
        }
      } catch (err) {
        lastErr = err
      }
    }

    throw lastErr || new Error('OpenClaw WS connection failed')
  }

  attachWsDispatchers (client) {
    const { ws, pending } = client
    ws.onmessage = (event) => {
      let payload
      try {
        payload = JSON.parse(String(event?.data || ''))
      } catch (err) {
        return
      }

      if (payload?.type === 'event') {
        client.lastEvent = payload
        if (payload?.event === 'connect.challenge') {
          client.connectChallenge = payload?.payload || null
        }
        return
      }

      if (payload?.type !== 'res') {
        return
      }

      const id = payload?.id != null ? String(payload.id) : ''
      if (!id || !pending.has(id)) return

      const deferred = pending.get(id)
      pending.delete(id)
      clearTimeout(deferred.timer)

      if (payload?.ok === false) {
        deferred.reject(
          new Error(
            this.rpcErrorToString(payload?.error || payload)
          )
        )
        return
      }

      deferred.resolve(this.extractRpcResult(payload?.payload))
    }

    ws.onclose = (event) => {
      client.closed = true
      for (const [id, deferred] of pending.entries()) {
        clearTimeout(deferred.timer)
        deferred.reject(
          new Error(
            `OpenClaw WS closed while waiting response (id=${id}, code=${event?.code || 0})`
          )
        )
      }
      pending.clear()
    }

    ws.onerror = () => {}
  }

  async callWsRpc (client, method, params = {}, timeoutMs) {
    const ws = client?.ws
    if (!ws || ws.readyState !== 1) {
      throw new Error('OpenClaw WS is not connected')
    }
    const requestTimeoutMs = Number(timeoutMs || Config.openClawWsRequestTimeoutMs || 15000)
    const id = String(client.nextId++)
    const payload = { type: 'req', id, method, params }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        client.pending.delete(id)
        reject(
          new Error(`OpenClaw WS RPC timeout: ${method} (${requestTimeoutMs}ms)`)
        )
      }, requestTimeoutMs)

      client.pending.set(id, { resolve, reject, timer })
      try {
        ws.send(JSON.stringify(payload))
      } catch (err) {
        clearTimeout(timer)
        client.pending.delete(id)
        reject(err)
      }
    })
  }

  closeWsClient (client) {
    if (!client?.ws || client.closed) return
    try {
      client.ws.close()
    } catch (err) {}
    client.closed = true
  }

  async tryWsConnectHandshake (client) {
    const methods = this.parseCsv(Config.openClawWsConnectMethods, ['connect'])
    const baseClient = {
      id: 'chatgpt-yunzai',
      version: '2.0.2',
      platform: process.platform || 'linux',
      mode: 'operator'
    }
    const token = String(Config.openClawToken || '').trim()
    const protocolCandidates = this.parseCsv(
      Config.openClawProtocolVersions,
      ['3', '7']
    )
      .map((item) => Number(item))
      .filter((item) => Number.isFinite(item) && item > 0)

    const paramsCandidates = []
    for (const protocol of protocolCandidates) {
      const base = {
        minProtocol: protocol,
        maxProtocol: protocol,
        client: baseClient,
        role: 'operator',
        scopes: ['operator.read', 'operator.write'],
        caps: [],
        commands: [],
        permissions: {},
        locale: 'zh-CN',
        userAgent: `chatgpt-yunzai/2.0.2 node/${process.versions?.node || 'unknown'}`
      }
      paramsCandidates.push(base)
      paramsCandidates.push({
        ...base,
        auth: token ? { token } : undefined
      })
    }
    if (token) {
      paramsCandidates.unshift({
        minProtocol: 3,
        maxProtocol: 3,
        client: baseClient,
        role: 'operator',
        scopes: ['operator.read', 'operator.write'],
        caps: [],
        commands: [],
        permissions: {},
        auth: { token },
        locale: 'zh-CN',
        userAgent: `chatgpt-yunzai/2.0.2 node/${process.versions?.node || 'unknown'}`
      })
    }

    for (const method of methods) {
      for (const params of paramsCandidates) {
        try {
          await this.callWsRpc(client, method, params, 3000)
          return true
        } catch (err) {}
      }
    }

    return false
  }

  buildSubmitPayload (message, sessionKey) {
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
    return payload
  }

  async callWsFirstSuccess (client, methods = [], payloadCandidates = []) {
    let lastErr
    for (const method of methods) {
      for (const params of payloadCandidates) {
        try {
          const result = await this.callWsRpc(client, method, params)
          return { method, result, params }
        } catch (err) {
          lastErr = err
        }
      }
    }
    throw lastErr || new Error('OpenClaw WS call failed')
  }

  async fetchWsMessages (client, sessionKey) {
    const methods = this.parseCsv(Config.openClawWsHistoryMethods, [
      'chat.history',
      'sessions_history',
      'sessions.history'
    ])

    const payloadCandidates = [
      { session: sessionKey },
      { session: sessionKey, limit: 30 },
      { session: sessionKey, count: 30 },
      { sessionKey },
      { sessionKey, count: 30 },
      { key: sessionKey },
      { sessionId: sessionKey },
      { sessionKey, limit: 30 },
      { key: sessionKey, limit: 30 }
    ]

    let lastErr
    for (const method of methods) {
      for (const params of payloadCandidates) {
        try {
          const payload = await this.callWsRpc(client, method, params, 8000)
          const messages = this.getMessagesFromPayload(payload, sessionKey)
          if (messages.length > 0) {
            return messages
          }
          if (Array.isArray(payload)) {
            const latest = this.findLatestAssistantMessage(payload, {
              completedOnly: false
            })
            if (latest) return payload
          }
        } catch (err) {
          lastErr = err
        }
      }
    }

    if (lastErr) throw lastErr
    return []
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

  async submitMessageWs (client, message, sessionKey) {
    const methods = this.parseCsv(Config.openClawWsSubmitMethods, [
      'chat.send',
      'hooks_agent',
      'hooks.agent'
    ])
    const idempotencyKey = this.buildIdempotencyKey(sessionKey)
    const base = this.buildSubmitPayload(message, sessionKey)
    const payloadCandidates = [
      {
        session: sessionKey,
        text: message,
        idempotencyKey
      },
      {
        sessionKey,
        text: message,
        idempotencyKey
      },
      {
        session: sessionKey,
        message,
        idempotencyKey
      },
      {
        ...base,
        text: message,
        idempotencyKey
      },
      { ...base, input: message },
      { ...base, sessionId: sessionKey, idempotencyKey },
      { sessionKey, text: message, idempotencyKey },
      { sessionId: sessionKey, text: message, idempotencyKey }
    ]
    return this.callWsFirstSuccess(client, methods, payloadCandidates)
  }

  async getLatestAssistantReplyWs (client, sessionKey) {
    try {
      const messages = await this.fetchWsMessages(client, sessionKey)
      return this.findLatestAssistantMessage(messages, { completedOnly: true })
    } catch (err) {
      return null
    }
  }

  async pollAssistantReplyWs (client, sessionKey, previousReply = null) {
    const pollIntervalMs = Number(Config.openClawPollIntervalMs || 1000)
    const pollTimeoutMs = Number(Config.openClawPollTimeoutMs || 120000)
    const start = Date.now()
    let lastErr

    while (Date.now() - start <= pollTimeoutMs) {
      try {
        const messages = await this.fetchWsMessages(client, sessionKey)
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
        if (stopReason === 'error') {
          throw new Error(`OpenClaw assistant returned error state for ${sessionKey}`)
        }
      } catch (err) {
        lastErr = err
      }

      await delay(pollIntervalMs)
    }

    if (lastErr) {
      throw lastErr
    }
    throw new Error(
      `OpenClaw WS polling timed out after ${pollTimeoutMs}ms for session ${sessionKey}`
    )
  }

  isRestUnavailableError (err) {
    const message = String(err?.message || err || '').toLowerCase()
    return (
      message.includes('status 404') ||
      message.includes('status 405') ||
      message.includes('enotfound') ||
      message.includes('econnrefused') ||
      message.includes('failed to fetch')
    )
  }

  async askViaRest (questionBody, sessionKey) {
    const previousReply = await this.getLatestAssistantReply(sessionKey)
    await this.submitMessage(questionBody, sessionKey)

    if (Config.openClawDeliver) {
      return new Response(
        '消息已提交到 OpenClaw 渠道，请在目标渠道查看回复。',
        undefined,
        sessionKey,
        { sessionKey, delivered: true, transport: 'rest' }
      )
    }

    const text = await this.pollAssistantReply(sessionKey, previousReply)
    return new Response(text, undefined, sessionKey, { sessionKey, transport: 'rest' })
  }

  async askViaWs (questionBody, sessionKey) {
    const client = await this.connectWsClient()
    this.attachWsDispatchers(client)
    const connected = await this.tryWsConnectHandshake(client)
    if (!connected) {
      throw new Error('OpenClaw WS connect failed: connect handshake rejected')
    }

    try {
      try {
        const healthMethods = this.parseCsv(
          Config.openClawWsHealthMethods,
          ['health']
        )
        await this.callWsFirstSuccess(client, healthMethods, [{}, { detail: false }])
      } catch (err) {}

      const previousReply = await this.getLatestAssistantReplyWs(client, sessionKey)
      const submitResult = await this.submitMessageWs(client, questionBody, sessionKey)
      const immediateText = this.extractResponseTextFromResult(submitResult?.result)
      if (immediateText) {
        return new Response(immediateText, undefined, sessionKey, {
          sessionKey,
          transport: 'ws'
        })
      }

      if (Config.openClawDeliver) {
        return new Response(
          '消息已提交到 OpenClaw 渠道，请在目标渠道查看回复。',
          undefined,
          sessionKey,
          { sessionKey, delivered: true, transport: 'ws' }
        )
      }

      const text = await this.pollAssistantReplyWs(client, sessionKey, previousReply)
      return new Response(text, undefined, sessionKey, {
        sessionKey,
        transport: 'ws'
      })
    } finally {
      this.closeWsClient(client)
    }
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

    const transport = this.getTransportMode()
    if (transport === 'rest') {
      return this.askViaRest(questionBody, sessionKey)
    }
    if (transport === 'ws' || transport === 'websocket') {
      return this.askViaWs(questionBody, sessionKey)
    }

    try {
      return await this.askViaRest(questionBody, sessionKey)
    } catch (err) {
      if (!this.isRestUnavailableError(err)) {
        throw err
      }
    }

    return this.askViaWs(questionBody, sessionKey)
  }
}

export default OpenClawApi
