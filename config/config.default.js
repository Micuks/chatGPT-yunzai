// === ChatGPT Settings ===
// Your proxy url if you use a proxy
const PROXY = "";

// Fill in if you use **OFFICIAL OPENAI DAVINCI MODEL**
const API_KEY = "";

// true if you subscribed ChatGPT plus and
const MODEL_PAID = false;

// true if you subscribed and want to use GPT-4
const USE_GPT4 = false;

// === Google Bard settings ===
const USE_BARD = false; // The master switch for Google Bard
const BARD_COOKIE =
  "__Secure-1PSID=<**Fill in your __Secure-1PSID cookie section**>";
// Your bard cookie. **Remember not to delete the __Secure-1PSID= prefix**

// # Advanced configuration

// Fill in the model you want to use
const MODEL_NAME = "gpt-3.5-turbo-0301";

// true if you use unofficial reverse proxy solution
const USE_UNOFFICIAL = false;

// Fill in if you use unofficial reverse proxy solution
const API_ACCESS_TOKEN = "";
/**
 * Fill in if you use unofficial reverse proxy solution.const (Optional)
 * You can get it from "https://chat.openai.com/api/auth/session"
 * The value of 'accessToken'
 */
API_REVERSE_PROXY_URL = "https://api.pawan.krd/backend-api/conversation	";

// Concurrency jobs, by default is 1
const CONCURRENCY_JOBS = 1;

// *** You need not to modify the settings below ***
export const Config = {
  modelName: MODEL_NAME,
  modelPaid: MODEL_PAID,
  apiAccessToken: API_ACCESS_TOKEN,
  useUnofficial: USE_UNOFFICIAL,
  proxy: PROXY,
  api_key: API_KEY,
  apiReverseProxyUrl: API_REVERSE_PROXY_URL,
  usePicture: false,
  useGpt4: USE_GPT4,
  useBard: USE_BARD,
  bardCookie: BARD_COOKIE,
  concurrencyJobs: CONCURRENCY_JOBS,
};
