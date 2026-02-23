import BlankPrompt from './blankPrompt.js'
import QuestionType from './question/QuestionType.js'
import Data from './data.js'

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
  }

  init = async () => {
    this.metaInfo = await this.getMetaInfo()

    // Get questionBody and questionType
    await this.parseQuestion()
  }

  parseQuestion = async () => {
    let openClawReg = /^(\?|？|!|！|claw|\/claw)([\s\S]*)$/i
    let chatGptReg = /^(gpt|\/gpt)([\s\S]*)$/i

    let msg = this.e.msg

    let questionBody = ''
    let questionType = QuestionType.OpenClaw

    if (chatGptReg.test(msg)) {
      questionBody = chatGptReg.exec(msg)[2]
      questionType = QuestionType.ChatGPT
    } else if (openClawReg.test(msg)) {
      questionType = QuestionType.OpenClaw
      questionBody = openClawReg.exec(msg)[2]
    } else {
      questionBody = BlankPrompt.blankPrompt
    }

    if (!questionBody || !questionBody.trim()) {
      questionBody = BlankPrompt.blankPrompt
    }

    this.questionBody = questionBody
    this.questionType = questionType
  }

  getMetaInfo = async () => {
    let metaInfo = await Data.getMetaInfo(this.sender.user_id)
    if (!metaInfo) {
      metaInfo = this.newMetaInfo()
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
      this.metaInfo = this.newMetaInfo()
      // Persistent meta info
      await this.setMetaInfo(this.metaInfo)
      return true
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

  updateMetaInfo = async (response = {}) => {
    let metaInfo = this.metaInfo
    metaInfo.utime = new Date()
    let thisInfo

    switch (this.questionType) {
      case QuestionType.OpenClaw:
        thisInfo = metaInfo.openClawInfo
        break
      case QuestionType.ChatGPT:
        thisInfo = metaInfo.chatGptInfo
        break
      default:
        console.log(`Unknown question type: ${this.questionType}`)
        break
    }
    if (!thisInfo) {
      return
    }
    thisInfo.count = thisInfo.count + 1
    if (this.questionType === QuestionType.ChatGPT) {
      thisInfo.parentMessageId =
        response.parentMessageId || thisInfo.parentMessageId
      thisInfo.conversationId = response.conversationId || thisInfo.conversationId
    } else if (this.questionType === QuestionType.OpenClaw) {
      const sessionKey =
        response?.params?.sessionKey || response?.conversationId || thisInfo.sessionKey
      thisInfo.sessionKey = sessionKey
    }

    await this.setMetaInfo(metaInfo)
  }

  newMetaInfo = () => {
    let ctime = new Date()
    let conversationId = this.sender.user_id
    return {
      ctime,
      utime: ctime,
      sender: this.sender,
      openClawInfo: {
        count: 0,
        sessionKey: `yunzai:qq:${conversationId}`
      },
      chatGptInfo: {
        count: 0,
        parentMessageId: undefined,
        conversationId: `${conversationId}-chatgpt`
      }
    }
  }
}
