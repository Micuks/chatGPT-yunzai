const USE_UNOFFICIAL = false; // true if you use unofficial reverse proxy solution
const PROXY = ""; // Your proxy url if you use a proxy

const MODEL_NAME = "gpt-3.5-turbo-0301"; // Fill in the model you want to use
const API_KEY = ""; // Fill in if you use **OFFICIAL OPENAI DAVINCI MODEL**

const API_REVERSE_PROXY_URL =
  "https://api.pawan.krd/backend-api/conversation	"; // (Optional)
// Fill in if you use unofficial reverse proxy solution.
// By default this is enough

const API_ACCESS_TOKEN = ""; // Fill in if you use unofficial reverse proxy solution
// You can get it from "https://chat.openai.com/api/auth/session"
// The value of 'accessToken'
const MODEL_PAID = false; // true if you subscribed ChatGPT plus and
const USE_GPT4 = false; // true if you subscribed and want to use GPT-4
// use unofficial reverse proxy solution

// Google Bard settings
const USE_BARD = false; // The master switch for Google Bard
const BARD_COOKIE =
  "__Secure-1PSID=<**Fill in your __Secure-1PSID cookie section**>";
// Your bard cookie. **Remember not to delete the __Secure-1PSID= prefix**

// You need not to modify the settings below
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
};
