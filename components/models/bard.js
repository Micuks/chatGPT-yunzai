import {Bard} from 'googlebard'
import {Config} from '../../config/config.js'
import Response from '../question/Response.js'

class BardAPI {
  constructor () {
    if (!Config.useBard) {
      console.log('Bard is not enabled')
      this.Bard = undefined
    }

    const proxyParams = this.setProxy()
    let params = { proxy: proxyParams }

    this._bardCookie = Config.bardCookie
    this._params = params
    this.Bard = new Bard(this._bardCookie, this._params)
  }

  setProxy () {
    let proxy = Config.proxy
    if (proxy) {
      logger.info(`Use proxy ${proxy} for bard.`)
      let proxySlice = proxy.split(':')
      if (proxySlice.length === 3) {
        return {
          host: proxySlice[1].slice(2, proxySlice[1].length),
          port: proxySlice[2],
          protocol: proxySlice[0] || 'http'
        }
      } else if (proxySlice.length === 2) {
        return {
          host: proxySlice[0],
          port: proxySlice[1],
          protocol: 'http'
        }
      }
    }

    return false
  }

  async ask (questionBody = '', params = {}) {
    // parentMessageId is not needed for Bard
    const { systemMessage, conversationId, parentMessageId } = params

    // Bard systemMessage need to be appended manually
    let question = systemMessage + questionBody
    let res = ''
    let response

    if (this.Bard === undefined || this.Bard === null) {
      console.log('Bard is not enabled, don\'t force me to do this...')
    }
    try {
      res = await this.Bard.ask(questionBody, conversationId)
      response = new Response(res, conversationId, conversationId, params)
    } catch (err) {
      // I don't want to handle err here
      console.log(`Error asking bard: ${err}`)
      throw err
    }

    return response
  }

  resetConversation = async (conversationId) => {
    this.Bard.resetConversation(conversationId)
  }
}

export default BardAPI
