// === Chat Models ===
// Proxy address used by all providers (for example: http://127.0.0.1:7890)
const PROXY = "";

// Default API key for OpenAI-compatible providers
const API_KEY = "";

// Base URL for OpenAI-compatible APIs
const API_BASE_URL = "https://api.openai.com/v1";

// Request timeout (ms) for HTTP models
const REQUEST_TIMEOUT = 60000;

// === Google Bard settings ===
const BARD_COOKIE =
  "__Secure-1PSID=<**Fill in your __Secure-1PSID cookie section**>";
// Your bard cookie. **Remember not to delete the __Secure-1PSID= prefix**

// Concurrency jobs, by default is 1
const CONCURRENCY_JOBS = 1;

// === Model routing ===
// Configure triggers, API endpoint, and system prompt for each model.
const MODEL_PROVIDERS = [
  {
    key: "chatgpt",
    name: "OpenAI GPT-3.5 Turbo",
    type: "openai",
    default: true,
    enabled: true,
    triggers: ["?", "？", "!", "！", "gpt", "/gpt"],
    request: {
      baseUrl: API_BASE_URL,
      path: "/chat/completions",
      apiKey: API_KEY,
      model: "gpt-3.5-turbo-0125",
      timeout: REQUEST_TIMEOUT
    },
    systemMessage:
      'You are ChatGPT, a large language model maintained by the bot owner. Default language: Chinese. Current date: {{current_datetime}}. If users need more information they can visit "https://github.com/Micuks/chatGPT-yunzai".'
  },
  {
    key: "kimi",
    name: "Moonshot Kimi",
    type: "openai",
    enabled: false,
    triggers: ["kimi", "/kimi"],
    request: {
      url: "http://127.0.0.1:18800/v1/chat/completions",
      apiKey: "",
      model: "kimi-k2",
      timeout: REQUEST_TIMEOUT,
      headers: {
        // Example: "Authorization": "Bearer YOUR_TOKEN"
      }
    },
    systemMessage:
      '你是 Moonshot Kimi，在中文环境下提供详细且安全的回答。当前日期：{{current_datetime}}。'
  }
];

// *** You need not to modify the settings below ***
export const Config = {
  proxy: PROXY,
  apiKey: API_KEY,
  apiBaseUrl: API_BASE_URL,
  bardCookie: BARD_COOKIE,
  concurrencyJobs: CONCURRENCY_JOBS,
  requestTimeout: REQUEST_TIMEOUT,
  modelProviders: MODEL_PROVIDERS
};
