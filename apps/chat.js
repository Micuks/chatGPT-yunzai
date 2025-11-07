import _ from 'lodash'
import plugin from '../../../lib/plugins/plugin.js'
import QuestionData from '../components/question/QuestionData.js'
import QuestionQueue from '../components/queue.js'
import { getModelRegistry } from '../components/models/model-registry.js'
import Data from '../components/data.js'

const MAX_RETRIES = 5

const questionQueue = new QuestionQueue(
  `ChatGptQueue-${Math.round(new Date().getTime() / 1000)}`
)

questionQueue.controller()

const registry = getModelRegistry()

const escapeRegExp = (str = '') => _.escapeRegExp(str)

const computeTriggerRegex = () => {
  const triggerSet = new Set()

  registry.providers.forEach((provider) => {
    const raw = provider.rawTriggers || []
    raw
      .filter((item) => typeof item === 'string')
      .forEach((token) => triggerSet.add(token))
  })

  if (!triggerSet.size) {
    ;['?', '？', '!', '！', 'gpt', '/gpt', 'gpt4', '/gpt4', 'bard', '/bard'].forEach((t) =>
      triggerSet.add(t)
    )
  }

  triggerSet.add('@')

  const pattern = Array.from(triggerSet)
    .map((token) => escapeRegExp(token))
    .join('|')

  return new RegExp(`^[\\s]*(?:${pattern})[\\s\\S]*$`, 'i')
}

const MESSAGE_TRIGGER_REGEX = computeTriggerRegex()

const normalizeIncomingMessage = (e) => {
  const segments = Array.isArray(e.message) ? e.message : []
  let wasMentioned = false
  const parts = []

  if (segments.length) {
    for (const segment of segments) {
      if (segment.type === 'at' && `${segment.qq}` === `${e.self_id}`) {
        wasMentioned = true
        continue
      }

      if (typeof segment.text === 'string') {
        parts.push(segment.text)
      }
    }
  }

  let text = parts.join('')
  if (!text) {
    text = e.msg || ''
  }

  return { text: text.trim(), wasMentioned }
}

const resolveQuestionContext = (e) => {
  const messageInfo = normalizeIncomingMessage(e)
  if (!messageInfo.text && !messageInfo.wasMentioned) {
    return undefined
  }

  const match = registry.match(messageInfo.text, {
    forceDefault: messageInfo.wasMentioned
  })

  if (!match.provider) {
    return undefined
  }

  return {
    providerKey: match.provider?.key,
    questionBody: match.body,
    normalizedMessage: messageInfo.text,
    wasMentioned: messageInfo.wasMentioned,
    matchReason: match.reason
  }
}

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
          reg: MESSAGE_TRIGGER_REGEX,
          fnc: 'chat'
        },
        {
          reg: '^#模型设置(?:[\s]*\d+)?$',
          fnc: 'configureModel'
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
    const context = resolveQuestionContext(e)
    if (!context) {
      return false
    }

    const question = new QuestionData(e.msg, e, context)

    await this.doJob(e, question)
  }

  async configureModel (e) {
    const text = (e.msg || '').trim()
    const match = /^#模型设置(?:\s*(\d+))?$/.exec(text)
    if (!match) {
      return false
    }

    const selection = match[1]
    const providers = registry.providers || []
    if (!providers.length) {
      await e.reply('暂无可用模型。请先在配置中启用至少一个模型。', true)
      return true
    }

    const userId = e.sender?.user_id
    if (!userId) {
      await e.reply('未能识别用户身份，无法保存模型设置。', true)
      return true
    }

    let meta = (userId && (await Data.getMetaInfo(userId))) || null
    if (!meta) {
      const now = new Date()
      meta = {
        ctime: now,
        utime: now,
        sender: e.sender,
        sessions: {}
      }
    } else {
      meta.sessions = meta.sessions || {}
    }

    const preferredKey = meta.preferredModel
    const defaultKey = registry.getDefault()?.key

    if (!selection) {
      const lines = providers.map((provider, index) => {
        const tags = []
        if (provider.key === preferredKey) tags.push('当前')
        if (provider.key === defaultKey) tags.push('默认')
        const suffix = tags.length ? ` [${tags.join(', ')}]` : ''
        return `${index + 1}. ${provider.name}${suffix}`
      })
      const triggers = providers
        .map((provider) => {
          if (!Array.isArray(provider.rawTriggers)) return null
          const sample = provider.rawTriggers
            .map((item) => (typeof item === 'string' ? item : null))
            .filter(Boolean)
            .slice(0, 3)
          if (!sample.length) return null
          return `${provider.name}: ${sample.join(', ')}`
        })
        .filter(Boolean)

      const parts = [
        '请选择要使用的模型：',
        ...lines,
        '',
        '发送「#模型设置 序号」即可切换模型。'
      ]

      if (triggers.length) {
        parts.push('', '常用触发词：', ...triggers)
      }

      await e.reply(parts.join('\n'), true)
      return true
    }

    const index = Number.parseInt(selection, 10) - 1
    if (Number.isNaN(index) || index < 0 || index >= providers.length) {
      await e.reply('无效的模型序号，请重新选择。', true)
      return true
    }

    const provider = providers[index]
    meta.preferredModel = provider.key
    meta.utime = new Date()
    await Data.setMetaInfo(userId, meta)

    await e.reply(`已切换到「${provider.name}」。`, true)
    return true
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
