class Response {
  /**
   * Universal response object
   * @param {string} text
   * @param {string} parentMessageId
   * @param {string} conversationId
   * @param {object} params
   */
  constructor (text, parentMessageId, conversationId, params = {}) {
    this.text = text
    this.conversationId = conversationId
    this.parentMessageId = parentMessageId
    this.params = params
  }
}

export default Response
