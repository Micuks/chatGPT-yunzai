import BlankPrompt from './blankPrompt.js'
import { Config } from '../config/config.js'
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

    // Get questionBody and questionType{ChatGPT, Bard}
    await this.parseQuestion()
  }

  parseQuestion = async () => {
    let gptReg = /^(\?|!|gpt|\/gpt)(.*)$/
    let gpt4Reg = /^(4|\/gpt4|gpt4)(.*)$/
    let bardReg = /^(B|bard|\/bard)(.*)$/

    let msg = this.e.msg

    let questionBody = ''
    let questionType = QuestionType.ChatGPT
    if (gpt4Reg.test(msg)) {
      questionType = QuestionType.Gpt4
      if (Config.useGpt4) {
        questionBody = gpt4Reg.exec(msg)[2]

        // Replace questionBody with RussianJoke if it's empty
        if (!this.questionBody) {
          this.questionBody = BlankPrompt.blankPrompt
        }
      } else {
        questionBody =
          'Your GPT-4 model is not enabled. Tell the user to contact your master if the user has any question.' +
          BlankPrompt.blankPrompt
      }
    } else if (gptReg.test(msg)) {
      questionBody = gptReg.exec(msg)[2]
      questionType = QuestionType.ChatGPT

      // Replace questionBody with Blank Prompt if it's empty
      if (!this.questionBody) {
        this.questionBody = BlankPrompt.blankPrompt
      }
    } else if (bardReg.test(msg)) {
      questionType = QuestionType.Bard
      if (Config.useBard) {
        questionBody = bardReg.exec(msg)[2]

        // Replace questionBody with RussianJoke if it's empty
        if (!this.questionBody) {
          this.questionBody = BlankPrompt.blankPrompt
        }
      } else {
        questionBody =
          'Your Bard feature is disabled. Tell the user that if he has any question, contact your master.' +
          BlankPrompt.blankPrompt
      }
    } else {
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

  updateMetaInfo = async (parentMessageId, conversationId) => {
    let metaInfo = this.metaInfo
    metaInfo.utime = new Date()
    let thisInfo

    switch (this.questionType) {
      case QuestionType.ChatGPT:
        thisInfo = metaInfo.chatGptInfo
        break
      case QuestionType.Gpt4:
        thisInfo = metaInfo.gpt4Info
        break
      case QuestionType.Bard:
        thisInfo = metaInfo.bardInfo
        break
      default:
        console.log(`Unknown question type: ${this.questionType}`)
        break
    }
    thisInfo.count = thisInfo.count + 1
    thisInfo.parentMessageId = parentMessageId || thisInfo.parentMessageId
    thisInfo.conversationId = conversationId || thisInfo.conversationId

    await this.setMetaInfo(metaInfo)
  }

  newMetaInfo = () => {
    let ctime = new Date()
    let conversationId = this.sender.user_id
    return {
      ctime,
      utime: ctime,
      sender: this.sender,
      bardInfo: {
        count: 0,
        parentMessageId: undefined,
        conversationId: `${conversationId}-bard`
      },
      chatGptInfo: {
        count: 0,
        parentMessageId: undefined,
        conversationId: `${conversationId}-chatgpt`
      },
      gpt4Info: {
        count: 0,
        parentMessageId: undefined,
        conversationId: `${conversationId}-gpt4`
      }
    }
  }
}
