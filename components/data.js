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
  }
}

export default Data
