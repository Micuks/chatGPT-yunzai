// === OpenClaw (default provider) ===
const OPENCLAW_ENABLED = process.env.OPENCLAW_ENABLED
  ? process.env.OPENCLAW_ENABLED === 'true'
  : true
const OPENCLAW_BASE_URL =
  process.env.OPENCLAW_BASE_URL || 'http://127.0.0.1:18789'
const OPENCLAW_TOKEN = process.env.OPENCLAW_TOKEN || ''
// bearer | header | none
const OPENCLAW_AUTH_TYPE = process.env.OPENCLAW_AUTH_TYPE || 'bearer'
// Used when OPENCLAW_AUTH_TYPE=header
const OPENCLAW_AUTH_HEADER = process.env.OPENCLAW_AUTH_HEADER || 'x-openclaw-token'
const OPENCLAW_AGENT_HOOK_PATH =
  process.env.OPENCLAW_AGENT_HOOK_PATH || '/hooks/agent'
const OPENCLAW_SESSION_PATH = process.env.OPENCLAW_SESSION_PATH || '/sessions'
// query | path
const OPENCLAW_SESSION_MODE = process.env.OPENCLAW_SESSION_MODE || 'query'
const OPENCLAW_SESSION_QUERY_KEY =
  process.env.OPENCLAW_SESSION_QUERY_KEY || 'sessionKey'
const OPENCLAW_WAKE_MODE = process.env.OPENCLAW_WAKE_MODE || 'now'
const OPENCLAW_DELIVER = process.env.OPENCLAW_DELIVER
  ? process.env.OPENCLAW_DELIVER === 'true'
  : false
const OPENCLAW_DELIVER_CHANNEL = process.env.OPENCLAW_DELIVER_CHANNEL || ''
const OPENCLAW_DELIVER_TO = process.env.OPENCLAW_DELIVER_TO || ''
const OPENCLAW_POLL_INTERVAL_MS = Number(
  process.env.OPENCLAW_POLL_INTERVAL_MS || 1000
)
const OPENCLAW_POLL_TIMEOUT_MS = Number(
  process.env.OPENCLAW_POLL_TIMEOUT_MS || 120000
)
const OPENCLAW_SUBMIT_RETRIES = Number(
  process.env.OPENCLAW_SUBMIT_RETRIES || 2
)
const OPENCLAW_RETRY_DELAY_MS = Number(
  process.env.OPENCLAW_RETRY_DELAY_MS || 500
)

// === Legacy ChatGPT fallback (optional) ===
const LEGACY_CHATGPT_ENABLED = process.env.LEGACY_CHATGPT_ENABLED === 'true'
const MODEL_NAME = process.env.MODEL_NAME || 'gpt-3.5-turbo'
const API_KEY = process.env.OPENAI_API_KEY || ''
const USE_UNOFFICIAL = process.env.USE_UNOFFICIAL === 'true'
const API_ACCESS_TOKEN = process.env.API_ACCESS_TOKEN || ''
const API_REVERSE_PROXY_URL =
  process.env.API_REVERSE_PROXY_URL || 'https://api.pawan.krd/backend-api/conversation'

// Global
const PROXY = process.env.PROXY || ''
const CONCURRENCY_JOBS = Number(process.env.CONCURRENCY_JOBS || 1)

export const Config = {
  useOpenClaw: OPENCLAW_ENABLED,
  openClawBaseUrl: OPENCLAW_BASE_URL,
  openClawToken: OPENCLAW_TOKEN,
  openClawAuthType: OPENCLAW_AUTH_TYPE,
  openClawAuthHeader: OPENCLAW_AUTH_HEADER,
  openClawAgentHookPath: OPENCLAW_AGENT_HOOK_PATH,
  openClawSessionPath: OPENCLAW_SESSION_PATH,
  openClawSessionMode: OPENCLAW_SESSION_MODE,
  openClawSessionQueryKey: OPENCLAW_SESSION_QUERY_KEY,
  openClawWakeMode: OPENCLAW_WAKE_MODE,
  openClawDeliver: OPENCLAW_DELIVER,
  openClawDeliverChannel: OPENCLAW_DELIVER_CHANNEL,
  openClawDeliverTo: OPENCLAW_DELIVER_TO,
  openClawPollIntervalMs: OPENCLAW_POLL_INTERVAL_MS,
  openClawPollTimeoutMs: OPENCLAW_POLL_TIMEOUT_MS,
  openClawSubmitRetries: OPENCLAW_SUBMIT_RETRIES,
  openClawRetryDelayMs: OPENCLAW_RETRY_DELAY_MS,

  legacyChatGptEnabled: LEGACY_CHATGPT_ENABLED,
  chatGptModel: MODEL_NAME,
  modelName: MODEL_NAME,
  apiAccessToken: API_ACCESS_TOKEN,
  useUnofficial: USE_UNOFFICIAL,
  proxy: PROXY,
  api_key: API_KEY,
  apiReverseProxyUrl: API_REVERSE_PROXY_URL,
  usePicture: false,
  concurrencyJobs: CONCURRENCY_JOBS
}
