import _ from 'lodash'
import plugin from '../../../lib/plugins/plugin.js'
import Question from '../components/question.js'
import QuestionData from '../components/question/QuestionData.js'
import QuestionQueue from '../components/queue.js'

const MAX_RETRIES = 5

const questionQueue = new QuestionQueue(
  `ChatGptQueue-${Math.round(new Date().getTime() / 1000)}`
)

questionQueue.controller()

export class chatgpt extends plugin {
  // TODO: timeout reset conversation
  // TODO: continuous conversation
  // TODO: reply if being ated by user
  // TODO: rename first_time to informUser
  constructor () {
    super({
      name: 'ChatGPT',
      dsc: 'chatgpt by openai',
      event: 'message',
      priority: 65536, // Larger number, lower priority
      rule: [
        {
          reg: '^[\\s]*(\\?|？|!|！|gpt|/gpt|4|/gpt4|gpt4|B|bard|/bard)[\\s\\S]*$',
          fnc: 'chat'
        },
        {
          reg: '^#聊天列表$',
          fnc: 'getChats',
          permission: 'master'
        },
        {
          reg: '^#(结束|停止)(聊天|对话)([\\s\\S]*)$',
          fnc: 'destroyChat'
        },
        {
          reg: '#(清除队列|清空队列)',
          fnc: 'cleanQueue'
        },
        {
          reg: '^[^#]+.*$',
          fnc: 'randomReply',
          desc: 'Reply a lucky user by random',
          log: false
        }
      ]
    })

    this.questionQueue = questionQueue
  }

  async getChats (e) {
    let keys = await redis.keys('CHATGPT:CHATS:*')
    if (!keys || keys.length === 0) {
      await this.reply('No chats now.', true)
    } else {
      let response = 'Current chats:\n'
      // response += 'Sender | Call counts | Start time | Last active time\n'
      await Promise.all(
        keys.map(async (key) => {
          let chat = await redis.get(key)
          if (chat) {
            chat = JSON.parse(chat)
            response += `${chat.sender.nickname}:\n\tRequest count: ${chat.count}\n\tStart time: ${chat.ctime}\n\tLast active time: ${chat.utime}\n`
          }
        })
      )
      await this.reply(`${response}`, true)
    }
  }

  // TODO: Implement this
  async destroyChat (e) {
    let atMessages = e.message.filter((m) => m.type === 'at')
    if (atMessages.length === 0) {
      let chat = await redis.get(`CHATGPT:CHATS:${e.sender.user_id}`)
      if (!chat) {
        await this.reply('You are not chatting with me.', true)
      } else {
        await redis.del(`CHATGPT:CHATS:${e.sender.user_id}`)
        await this.reply('Chat destroyed.', true)
      }
    } else {
      let at = atMessages[0]
      let qq = at.qq
      let atUser = _.trimStart(at.text, '@')
      let chat = await redis.get(`CHATGPT:CHATS:${qq}`)
      if (!chat) {
        await this.reply(`No chats are opened by ${atUser}`, true)
      } else {
        await redis.del(`CHATGPT:CHATS:${qq}`)
        await this.reply(`Destroyed chats of ${atUser}[${qq}]`, true)
      }
    }
  }

  async chat (e) {
    const msg = e.msg
    const question = new QuestionData(msg, e)

    await this.doJob(e, question)
  }

  async doJob (e, question, cfg = { first_time: true, ttl: MAX_RETRIES }) {
    let { first_time: firstTime, ttl } = cfg
    let job = await this.questionQueue.enQueue(e, question)
    if (firstTime) {
      let wJobs = await this.questionQueue.getWaitingJobs()
      let aJobs = await this.questionQueue.getActiveJobs()

      e.reply(
        `${e.sender.nickname}, Thinking...\n` +
          `Waiting jobs: ${wJobs}\n` +
          `Active jobs: ${aJobs}`,
        true,
        { recallMsg: 10 }
      )
    }
    let retry = false

    await job
      .finished()
      .then((res) => {
        console.log(
          `Job ${job.id} issued by ${e.sender.nickname}[${e.sender.user_id}] finished.`
        )
        this.callback(e, res)
      })
      .catch((err) => {
        if (ttl > 0) {
          console.log(
            `Error occurred in job ${job.id} issued by ${e.sender.nickname}[${e.sender.user_id}]. Retrying...(${ttl} times left)`
          )
          console.debug(err)
          retry = true
        } else {
          console.log(
            `Error occurred in job ${job.id} issued by ${e.sender.nickname}[${e.sender.user_id}]. Max retries exceeded.`
          )
          console.debug(err)
          e.reply(
            `${e.sender.nickname}, Failed to answer your question. Please retry later. ${e.sender.nickname}, 没能回答您的问题, 请重试.`
          )
        }
      })

    if (retry) {
      await this.doJob(e, question, { first_time: false, ttl: ttl - 1 })
    }
  }

  async callback (e, response) {
    this.e = e
    await this.reply(response.text, true)
    // Chat is updated in queue
  }

  // TODO: cleanQueue
  async cleanQueue (e) {
    this.questionQueue.queue.clean(5000, 'active')
    this.questionQueue.queue.clean(5000, 'wait')
    logger.info('Successfully cleaned active job queue!')
    await e.reply('清空队列完毕')
  }

  async randomReply (e) {}

  async randomReplyCheck (e) {}
}
