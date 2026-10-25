const Data = {
  getMetaInfo: async (user_id) => {
    const meta = await redis.get(`CHATGPT:META:${user_id}`)
    if (!meta) {
      return null
    }
    try {
      return JSON.parse(meta)
    } catch (err) {
      console.log(`Failed to parse meta info for user ${user_id}: ${err}`)
      return null
    }
  },

  setMetaInfo: async (user_id, chat) => {
    await redis.set(`CHATGPT:META:${user_id}`, JSON.stringify(chat))
  },

  getOpenClawSessionKey: async (user_id) => {
    const key = await redis.get(`CHATGPT:OPENCLAW_SESSION:${user_id}`)
    return key || `yunzai:qq:${user_id}`
  },

  rotateOpenClawSessionKey: async (user_id) => {
    const key = `yunzai:qq:${user_id}:${Date.now().toString(36)}`
    await redis.set(`CHATGPT:OPENCLAW_SESSION:${user_id}`, key)
    return key
  }
}

export default Data
