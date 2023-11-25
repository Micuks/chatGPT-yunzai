import { Config } from "../../config/config";

export default class QuestionData {
  constructor(msg, e, params = {}) {
    this.sender = e.sender;
    this.msg = msg;
    this.params = params;
  }
}
