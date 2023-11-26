class Response {
  constructor(test, parentMessageId, conversationId, params = {}) {
    this.text;
    this.conversationId;
    this.parentMessageId;
    this.params = params;
  }
}

export default Response;
