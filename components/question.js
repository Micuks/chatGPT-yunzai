import BlankPrompt from './blankPrompt.js'
import Data from './data.js'
import { getModelRegistry } from './models/model-registry.js'

/**
 * Remember to init it after creating a new Question
 */
export default class Question {
  /**
   *
   * @param {QuestionData} questionData
   * @param {object} cfg
   * @param {object} cfg.e MessageEvent
   * @param {boolean} cfg.resetExpired reset expired chat or not
   * @param {string} cfg.msg Message
   */
  constructor (questionData, cfg = {}) {
    const {
      e,
      resetExpired
    } = cfg
    this.e = e
    this.resetExpired = resetExpired
    const {
      sender,
      msg,
      params
    } = questionData
    this.questionData = questionData
    this.sender = sender
    this.user_id = this.sender.user_id
    this.msg = msg
    this.params = params
    this.cfg = cfg
    this.CONVERSATION_TIMEOUT = 600000
    this.registry = getModelRegistry()
    this.modelProfile = undefined
    this.session = undefined
    this.shouldReply = true
    this.wasMentioned = false
    this.normalizedMessage = undefined
  }

  init = async () => {
    this.metaInfo = await this.getMetaInfo()

    await this.parseQuestion()

    if (!this.shouldReply) {
      return
    }

    this.session = this.ensureSession()
  }

  parseQuestion = async () => {
    const params = this.params || {}
    const {
      normalizedMessage,
      wasMentioned,
      providerKey,
      questionBody
    } = params
    let matchReason = params.matchReason
    let messageInfo

    if (typeof normalizedMessage === 'string') {
      this.normalizedMessage = normalizedMessage
      this.wasMentioned = Boolean(wasMentioned)
      messageInfo = { text: normalizedMessage, wasMentioned: this.wasMentioned }
    } else {
      messageInfo = this.normalizeMessage()
    }

    let provider = undefined
    let body = questionBody

    if (providerKey) {
      provider = this.registry.getByKey(providerKey)
    }

    if (!provider) {
      const match = this.registry.match(messageInfo.text, {
        forceDefault: messageInfo.wasMentioned
      })
      provider = match.provider
      if (body === undefined) {
        body = match.body
      }
      if (!matchReason) {
        matchReason = match.reason
        params.matchReason = matchReason
      }
    }

    const preferredKey = this.metaInfo?.preferredModel
    const preferredProvider = preferredKey
      ? this.registry.getByKey(preferredKey)
      : undefined

    if (
      preferredProvider &&
      (!provider ||
        matchReason === 'forced-default' ||
        matchReason === 'forced-default-empty')
    ) {
      provider = preferredProvider
    }

    if (!provider) {
      provider = this.registry.getDefault()
    }

    if (!provider) {
      this.shouldReply = false
      this.questionBody = ''
      return
    }

    this.modelProfile = provider
    this.questionType = provider.key

    const content = typeof body === 'string' ? body.trim() : messageInfo.text
    this.questionBody = content && content.length > 0 ? content : BlankPrompt.blankPrompt
  }

  getMetaInfo = async () => {
    let metaInfo = await Data.getMetaInfo(this.sender.user_id)
    if (!metaInfo) {
      metaInfo = this.newMetaInfo()
    } else if (!metaInfo.sessions) {
      const migrated = this.newMetaInfo()
      migrated.ctime = metaInfo.ctime ? new Date(metaInfo.ctime) : new Date()
      migrated.utime = metaInfo.utime ? new Date(metaInfo.utime) : new Date()
      migrated.sender = metaInfo.sender || this.sender

      const legacyToSession = (info, key) => {
        if (!info) return
        migrated.sessions[key] = {
          key,
          count: info.count || 0,
          conversationId:
            info.conversationId || `${this.sender.user_id}-${key}`,
          parentMessageId: info.parentMessageId,
          history: []
        }
      }

      legacyToSession(metaInfo.chatGptInfo, 'chatgpt')
      legacyToSession(metaInfo.gpt4Info, 'gpt4')
      legacyToSession(metaInfo.bardInfo, 'bard')

      metaInfo = migrated
      await this.setMetaInfo(metaInfo)
    }

    return metaInfo
  }

  refreshMetaInfo = async () => {
    let currTime = new Date()
    let utime = this.metaInfo.utime
    if (typeof utime === 'string') {
      utime = new Date(utime)
    }
    let timeElapsed = currTime - utime
    let timeout = this.CONVERSATION_TIMEOUT
    if (!utime || !(utime instanceof Date) || timeElapsed > timeout || !this.metaInfo) {
      if (!this.metaInfo.sender) {
        console.log(`Refreshed conversation for user. Time elapsed: ${timeElapsed} ms`)
      } else {
        console.log(`Refreshed conversation for user${this.metaInfo.sender.nickname}[${this.metaInfo.sender.user_id}]. Time elapsed: ${timeElapsed} ms`)
      }
      const preferredModel = this.metaInfo?.preferredModel
      this.metaInfo = this.newMetaInfo({ preferredModel })
      // Persistent meta info
      await this.setMetaInfo(this.metaInfo)
      this.session = this.ensureSession(true)
      return true
    }
    if (this.modelProfile) {
      this.session = this.ensureSession()
    }
    return false
  }

  setMetaInfo = async (metaInfo) => {
    try {
      await Data.setMetaInfo(this.user_id, metaInfo)
    } catch (err) {
      console.log(
        `Failed to set Meta Info for user ${this.sender.user_id}: ${err}`
      )
      return false
    }

    return true
  }

  applyResponse = async (response) => {
    if (!this.modelProfile) return

    const session = this.ensureSession()
    if (!session) return

    const now = new Date()
    this.metaInfo.utime = now
    session.count = (session.count || 0) + 1
    session.parentMessageId = response?.parentMessageId || session.parentMessageId
    session.conversationId = response?.conversationId || session.conversationId
    session.lastResponseAt = now

    if (!Array.isArray(session.history)) {
      session.history = []
    }

    if (this.questionBody) {
      session.history.push({ role: 'user', content: this.questionBody })
    }

    if (response?.text) {
      session.history.push({ role: 'assistant', content: response.text })
    }

    const historySize = this.modelProfile.historySize ?? this.modelProfile.maxHistory ?? 6
    if (historySize > 0 && session.history.length > historySize * 2) {
      session.history = session.history.slice(-historySize * 2)
    }

    await this.setMetaInfo(this.metaInfo)
  }

  newMetaInfo = (overrides = {}) => {
    const now = new Date()
    return {
      ctime: overrides.ctime || now,
      utime: overrides.utime || now,
      sender: overrides.sender || this.sender,
      preferredModel:
        overrides.preferredModel !== undefined
          ? overrides.preferredModel
          : this.metaInfo?.preferredModel,
      sessions: overrides.sessions || {}
    }
  }

  ensureSession = (reset = false) => {
    if (!this.modelProfile) return undefined
    if (!this.metaInfo.sessions) {
      this.metaInfo.sessions = {}
    }

    const key = this.modelProfile.key
    const defaultConversationId = `${this.sender.user_id}-${key}`
    let session = this.metaInfo.sessions[key]

    if (!session || reset) {
      session = {
        key,
        history: [],
        count: 0,
        conversationId: defaultConversationId,
        parentMessageId: undefined,
        createdAt: new Date()
      }
    } else {
      session.conversationId = session.conversationId || defaultConversationId
      session.history = Array.isArray(session.history) ? session.history : []
    }

    this.metaInfo.sessions[key] = session
    return session
  }

  getSession = () => {
    if (!this.session) {
      this.session = this.ensureSession()
    }
    return this.session
  }

  normalizeMessage = () => {
    const segments = Array.isArray(this.e.message) ? this.e.message : []
    let wasMentioned = false
    const parts = []

    if (segments.length > 0) {
      for (const segment of segments) {
        if (segment.type === 'at' && `${segment.qq}` === `${this.e.self_id}`) {
          wasMentioned = true
          continue
        }

        if (typeof segment.text === 'string') {
          parts.push(segment.text)
        }
      }
    }

    let text = parts.join('')
    if (!text) {
      text = this.e.msg || ''
    }

    text = text.trim()
    this.wasMentioned = wasMentioned
    this.normalizedMessage = text
    return { text, wasMentioned }
  }
}
