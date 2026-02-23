import plugin from '../../../lib/plugins/plugin.js'
import { Config } from '../config/config.js'

export class openclaw extends plugin {
  constructor () {
    super({
      name: 'OpenClaw Admin',
      dsc: 'OpenClaw runtime commands',
      event: 'message',
      priority: 5000,
      rule: [
        {
          reg: '^#openclaw(状态|status)$',
          fnc: 'status',
          permission: 'master'
        },
        {
          reg: '^#(重置|清除)(openclaw|claw)(会话|session)$',
          fnc: 'resetSession'
        }
      ]
    })
  }

  async status (e) {
    const reply =
      `OpenClaw enabled: ${Config.useOpenClaw}\n` +
      `baseUrl: ${Config.openClawBaseUrl}\n` +
      `agentHook: ${Config.openClawAgentHookPath}\n` +
      `sessionPath: ${Config.openClawSessionPath}\n` +
      `sessionMode: ${Config.openClawSessionMode}\n` +
      `deliver: ${Config.openClawDeliver}\n` +
      `poll: ${Config.openClawPollIntervalMs}ms/${Config.openClawPollTimeoutMs}ms\n` +
      `legacyChatGPT: ${Config.legacyChatGptEnabled}`
    await e.reply(reply, true)
  }

  async resetSession (e) {
    const key = `CHATGPT:META:${e.sender.user_id}`
    const sessionKey = `yunzai:qq:${e.sender.user_id}`
    const metaRaw = await redis.get(key)
    if (!metaRaw) {
      await e.reply('当前没有会话记录。', true)
      return
    }

    let meta
    try {
      meta = JSON.parse(metaRaw)
    } catch (err) {
      await redis.del(key)
      await e.reply('会话记录已损坏，已清空。', true)
      return
    }

    meta.utime = new Date()
    if (!meta.openClawInfo) {
      meta.openClawInfo = { count: 0, sessionKey }
    } else {
      meta.openClawInfo.count = 0
      meta.openClawInfo.sessionKey = sessionKey
    }
    await redis.set(key, JSON.stringify(meta))
    await e.reply('OpenClaw 会话已重置。', true)
  }
}
