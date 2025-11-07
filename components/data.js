const ensureRedis = () => {
  if (globalThis.redis && typeof globalThis.redis.get === 'function') {
    return globalThis.redis
  }

  if (!globalThis.__chatgptStandaloneRedis) {
    const store = new Map()

    const matchesPattern = (key, pattern) => {
      if (!pattern || pattern === '*') return true
      if (!pattern.includes('*')) return key === pattern
      const [prefix, suffix] = pattern.split('*')
      if (prefix && !key.startsWith(prefix)) return false
      if (suffix && !key.endsWith(suffix)) return false
      return true
    }

    globalThis.__chatgptStandaloneRedis = {
      async get (key) {
        return store.has(key) ? store.get(key) : null
      },
      async set (key, value) {
        store.set(key, value)
      },
      async del (key) {
        store.delete(key)
      },
      async keys (pattern = '*') {
        return Array.from(store.keys()).filter((key) => matchesPattern(key, pattern))
      }
    }
  }

  return globalThis.__chatgptStandaloneRedis
}

const redisClient = ensureRedis()

const Data = {
  getMetaInfo: async (user_id) => {
    const raw = await redisClient.get(`CHATGPT:META:${user_id}`)
    if (!raw) return null

    try {
      return JSON.parse(raw)
    } catch (err) {
      console.warn(`Failed to parse meta info for ${user_id}: ${err}`)
      return null
    }
  },

  setMetaInfo: async (user_id, chat) => {
    await redisClient.set(`CHATGPT:META:${user_id}`, JSON.stringify(chat))
  }
}

export default Data
