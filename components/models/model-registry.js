import { Config } from '../../config/runtime.js'

const DEFAULT_SYSTEM_MESSAGE =
  'You are ChatGPT, a large language model maintained by the bot owner. Answer in Chinese by default. Current date: {{current_datetime}}.'

const isRegExp = (value) => Object.prototype.toString.call(value) === '[object RegExp]'

const normalizeTrigger = (trigger) => {
  if (!trigger) {
    return null
  }

  if (typeof trigger === 'string') {
    const trimmed = trigger.trim()
    if (trimmed.startsWith('regex:')) {
      return {
        type: 'regex',
        pattern: trimmed.slice(6)
      }
    }

    return {
      type: 'string',
      value: trimmed
    }
  }

  if (isRegExp(trigger)) {
    return {
      type: 'regex',
      pattern: trigger.source,
      flags: trigger.flags
    }
  }

  if (typeof trigger === 'object') {
    if (trigger.type === 'regex' || trigger.pattern) {
      return {
        type: 'regex',
        pattern: trigger.pattern || trigger.value || trigger.regex,
        flags: trigger.flags,
        bodyGroup: trigger.bodyGroup
      }
    }

    if (trigger.type === 'string' || trigger.value) {
      return {
        type: 'string',
        value: trigger.value,
        caseSensitive: trigger.caseSensitive
      }
    }
  }

  return null
}

const normalizeTriggers = (rawTriggers = []) => {
  const list = Array.isArray(rawTriggers) ? rawTriggers : [rawTriggers]
  return list
    .map(normalizeTrigger)
    .filter((item) => item && (item.type === 'regex' ? item.pattern : item.value))
}

const asArray = (value) => {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

const buildUrl = (request = {}) => {
  if (request.url) {
    return request.url
  }

  const baseUrl = request.baseUrl || Config.apiBaseUrl || 'https://api.openai.com/v1'
  const path = request.path || '/chat/completions'
  return `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
}

const clone = (value) => {
  try {
    return structuredClone(value)
  } catch (err) {
    return JSON.parse(JSON.stringify(value))
  }
}

class ModelProvider {
  constructor (config, defaults = {}) {
    const normalized = { ...config }
    this.key = normalized.key || normalized.id || `model-${Date.now()}`
    this.name = normalized.name || normalized.title || this.key
    this.type = (normalized.type || defaults.type || 'openai').toLowerCase()
    this.systemMessage =
      normalized.systemMessage || defaults.systemMessage || DEFAULT_SYSTEM_MESSAGE
    this.historySize =
      normalized.historySize ?? normalized.maxHistory ?? defaults.historySize ?? 6
    this.enabled = normalized.enabled !== false
    this.default = normalized.default || defaults.default || false
    this.request = {
      ...(defaults.request || {}),
      ...(normalized.request || {})
    }
    this.request.url = buildUrl(this.request)
    this.request.authScheme =
      this.request.authScheme || this.request.authType || defaults?.request?.authScheme
    this.triggers = normalizeTriggers(
      normalized.triggers || normalized.matchers || normalized.aliases || defaults.triggers
    )
    this.rawTriggers = clone(
      normalized.triggers || normalized.matchers || normalized.aliases || defaults.triggers
    )
    this.inherit = normalized.inherit
    this.payload = normalized.payload || defaults.payload || {}
  }

  match (text = '') {
    if (!text && !this.triggers.length) {
      return { matched: true, body: '' }
    }

    for (const trigger of this.triggers) {
      if (trigger.type === 'regex') {
        const regex = trigger._compiled || new RegExp(trigger.pattern, trigger.flags || 'i')
        trigger._compiled = regex
        const match = regex.exec(text)
        if (match) {
          const index = trigger.bodyGroup ?? (match.length > 1 ? 1 : 0)
          const body = match[index] || ''
          return { matched: true, body: body.trim() }
        }
      } else if (trigger.type === 'string') {
        const body = matchStringTrigger(text, trigger.value, trigger.caseSensitive)
        if (body !== null) {
          return { matched: true, body }
        }
      }
    }

    return { matched: false, body: '' }
  }
}

const LETTER_NUMBER_REG = /[a-z0-9]/i

const matchStringTrigger = (text = '', trigger = '', caseSensitive = false) => {
  if (!trigger) return null

  const trimmedText = text.trim()
  const compareText = caseSensitive ? trimmedText : trimmedText.toLowerCase()
  const compareTrigger = caseSensitive ? trigger : trigger.toLowerCase()

  if (!compareText.startsWith(compareTrigger)) {
    return null
  }

  if (compareTrigger.length > 1) {
    const triggerEndsWithLetter = LETTER_NUMBER_REG.test(
      compareTrigger.charAt(compareTrigger.length - 1)
    )
    const nextChar = compareText.charAt(compareTrigger.length)
    if (triggerEndsWithLetter && LETTER_NUMBER_REG.test(nextChar)) {
      return null
    }
  }

  let body = trimmedText.slice(trigger.length)
  body = body.replace(/^[\s:：\-]+/, '')
  return body.trim()
}

const buildFallbackProviders = () => {
  const baseUrl = Config.apiBaseUrl || 'https://api.openai.com/v1'
  return [
    {
      key: 'chatgpt',
      name: 'OpenAI GPT-3.5 Turbo',
      type: 'openai',
      default: true,
      triggers: ['?', '？', '!', '！', 'gpt', '/gpt'],
      request: {
        url: `${baseUrl.replace(/\/$/, '')}/chat/completions`,
        apiKey: Config.apiKey,
        timeout: Config.requestTimeout,
        model: 'gpt-3.5-turbo-0125'
      }
    }
  ]
}

const normalizeProviders = (configs = []) => {
  const normalized = []
  const queue = configs.map((cfg) => ({ cfg }))
  const seen = new Map()

  while (queue.length) {
    const item = queue.shift()
    const { cfg, parent } = item
    if (!cfg || cfg.enabled === false) continue
    const key = cfg.key || cfg.id || cfg.name
    if (key && seen.has(key)) {
      continue
    }

    if (cfg.inherit && !seen.has(cfg.inherit)) {
      queue.push(item)
      const parentConfig = configs.find((c) => c.key === cfg.inherit || c.id === cfg.inherit)
      if (parentConfig) {
        queue.push({ cfg: parentConfig })
      }
      continue
    }

    let defaults
    if (cfg.inherit) {
      defaults = normalized.find((provider) => provider.key === cfg.inherit)
    }

    const provider = new ModelProvider(cfg, defaults)
    normalized.push(provider)
    if (key) {
      seen.set(key, provider)
    }
  }

  if (!normalized.length) {
    return normalizeProviders(buildFallbackProviders())
  }

  if (!normalized.some((provider) => provider.default)) {
    normalized[0].default = true
  }

  return normalized
}

class ModelRegistry {
  constructor (configs) {
    this.providers = normalizeProviders(configs)
    this.providerMap = new Map(this.providers.map((provider) => [provider.key, provider]))
    this.defaultProvider =
      this.providers.find((provider) => provider.default) || this.providers[0]
  }

  getDefault () {
    return this.defaultProvider
  }

  getByKey (key) {
    if (!key) return undefined
    return this.providerMap.get(key)
  }

  match (text = '', options = {}) {
    const trimmed = (text || '').trim()
    if (!trimmed && !options.forceDefault) {
      return { provider: undefined, body: '', reason: 'empty' }
    }

    if (options.forceDefault && !trimmed) {
      return { provider: this.getDefault(), body: '', reason: 'forced-default-empty' }
    }

    for (const provider of this.providers) {
      const { matched, body } = provider.match(trimmed)
      if (matched) {
        return { provider, body, reason: 'trigger' }
      }
    }

    if (options.forceDefault) {
      return { provider: this.getDefault(), body: trimmed, reason: 'forced-default' }
    }

    return { provider: undefined, body: trimmed, reason: 'unmatched' }
  }
}

let registryInstance

export const getModelRegistry = () => {
  if (!registryInstance) {
    const configs = asArray(Config.modelProviders)
    registryInstance = new ModelRegistry(configs)
  }
  return registryInstance
}

export const resetModelRegistry = () => {
  registryInstance = undefined
}

export { ModelRegistry, ModelProvider }

