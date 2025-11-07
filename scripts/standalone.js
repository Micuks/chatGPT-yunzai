#!/usr/bin/env node
import { argv, exit } from 'node:process'
import readline from 'node:readline'
import { stdin as input, stdout as output } from 'node:process'

import { getModelRegistry } from '../components/models/model-registry.js'
import Question from '../components/question.js'
import QuestionData from '../components/question/QuestionData.js'
import { askAndReply } from '../components/ask.js'

const parseArgs = () => {
  const args = {
    mention: true
  }

  const tokens = argv.slice(2)
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]
    const next = tokens[i + 1]
    switch (token) {
      case '-p':
      case '--provider':
        args.provider = next
        i += 1
        break
      case '-m':
      case '--message':
        args.message = next
        i += 1
        break
      case '--no-mention':
        args.mention = false
        break
      case '--mention':
        args.mention = true
        break
      case '--list':
        args.list = true
        break
      case '--user':
        args.user = next
        i += 1
        break
      case '--nickname':
        args.nickname = next
        i += 1
        break
      case '--bot':
        args.bot = next
        i += 1
        break
      case '--help':
      case '-h':
        args.help = true
        break
      default:
        if (!token.startsWith('-') && !args.message) {
          args.message = token
        }
        break
    }
  }

  return args
}

const printHelp = () => {
  console.log(`Standalone tester for chatGPT-yunzai plugin.\n\nUsage:\n  node scripts/standalone.js [options] --message "你好"\n\nOptions:\n  -p, --provider <key>   指定要使用的模型（默认使用配置中的默认模型）\n  -m, --message <text>   要发送的消息内容（可省略以进入交互模式）\n      --list             列出所有可用模型\n      --mention/--no-mention  是否模拟被@触发（默认开启）\n      --user <id>        自定义发送者ID（默认 standalone-user）\n      --nickname <name>  自定义发送者昵称（默认 StandaloneUser）\n      --bot <id>         自定义机器人的ID（默认 chatGPT-yunzai）\n  -h, --help             查看本帮助\n`)
}

const main = async () => {
  const args = parseArgs()

  if (args.help) {
    printHelp()
    return
  }

  const registry = getModelRegistry()

  if (args.list) {
    console.log('可用模型：')
    registry.providers.forEach((provider) => {
      const flag = provider.default ? '[default]' : '         '
      console.log(`${flag} ${provider.key} -> ${provider.name} (${provider.type})`)
      if (provider.request?.url) {
        console.log(`             ${provider.request.url}`)
      }
    })
    return
  }

  let provider
  if (args.provider) {
    provider = registry.getByKey(args.provider)
    if (!provider) {
      console.error(`未找到模型：${args.provider}`)
      exit(1)
    }
  } else {
    provider = registry.getDefault()
  }

  let message = args.message
  if (!message) {
    const rl = readline.createInterface({ input, output })
    message = await new Promise((resolve) => {
      rl.question('请输入要发送给模型的消息：', (answer = '') => {
        rl.close()
        resolve(answer.trim())
      })
    })
  }

  if (!message) {
    console.error('消息不能为空。')
    exit(1)
  }

  const userId = args.user || 'standalone-user'
  const nickname = args.nickname || 'StandaloneUser'
  const botId = args.bot || 'chatGPT-yunzai'

  const event = {
    sender: {
      user_id: userId,
      nickname
    },
    self_id: botId,
    message: [{ type: 'text', text: message }],
    msg: message,
    reply: (text) => console.log(text)
  }

  const params = {
    providerKey: provider?.key,
    normalizedMessage: message,
    questionBody: message,
    wasMentioned: Boolean(args.mention)
  }

  const questionData = new QuestionData(message, event, params)
  const question = new Question(questionData, { e: event, msg: message })

  try {
    await question.init()
    if (!question.shouldReply) {
      console.log('未匹配到可用模型，结束。')
      return
    }

    const response = await askAndReply(question, { e: event })
    await question.applyResponse(response)

    console.log('\n=== 模型回复 ===')
    console.log(response.text)
  } catch (err) {
    console.error(`发送请求失败：${err.message || err}`)
    exit(1)
  }
}

main()
