import { Config } from "../../config/config.js";

export default class QuestionData {
  constructor(msg, e, params = {}) {
    this.sender = e.sender;
    this.msg = msg;
    this.params = params;
  }
}
