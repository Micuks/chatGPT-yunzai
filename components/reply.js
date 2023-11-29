import Question from './question.js'
import Render from './render.js'

let urlReg =
  /^https?:\/\/[\w\-_]+(\.[\w\-_]+)+([\w\-.,@?^=%&:/~+#]*[\w\-@?^=%&/~+#])?$/

let render = new Render()

const postProcess = async (questionData, response, cfg) => {
  let { e } = cfg
  if (urlReg.test(response)) {
    // Render and reply
    // questionInstance = new Question(questionData, cfg);
    return render.renderUrl(e, response)
  } else {
    e.reply(response, true)
  }
  return true
}

export default postProcess
