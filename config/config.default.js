const PROXY = ""; // Your proxy url if you use a proxy
const CAPTCHA_TOKEN = ""; // (deprecated) Used by browser based solution.
const NOPECHA_TOKEN = ""; // (deprecated) Used by browser based solution.
const API_KEY = ""; // Fill in if you use **OFFICIAL OPENAI DAVINCI MODEL**
const API_REVERSE_PROXY_URL = "https://chat.duti.tech/api/conversation"; // (Optional) Fill in if you use unofficial reverse proxy solution.
// By default this is enough
const API_ACCESS_TOKEN = ""; // Fill in if you use unofficial reverse proxy solution
const MODEL_PAID = false; // true if you subscribed ChatGPT plus
const USE_UNOFFICIAL = false; // true if you use unofficial reverse proxy solution

export const Config = {
  modelPaid: MODEL_PAID,
  apiAccessToken: API_ACCESS_TOKEN,
  useUnofficial: USE_UNOFFICIAL,
  token: SESSION_TOKEN,
  proxy: PROXY,
  api_key: API_KEY,
  captchaToken: CAPTCHA_TOKEN,
  nopechaKey: NOPECHA_TOKEN,
  apiReverseProxyUrl: API_REVERSE_PROXY_URL,
  usePicture: false,
};
