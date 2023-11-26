class Response {
  constructor(text, parentMessageId, conversationId, params = {}) {
    this.text = text;
    this.conversationId = conversationId;
    this.parentMessageId = parentMessageId;
    this.params = params;
  }
}

export default Response;
