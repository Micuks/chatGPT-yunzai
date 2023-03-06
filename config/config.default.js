const USE_UNOFFICIAL = false; // true if you use unofficial reverse proxy solution
const PROXY = ""; // Your proxy url if you use a proxy

const MODEL_NAME = "gpt-3.5-turbo-0301"; // Fill in the model you want to use
const API_KEY = ""; // Fill in if you use **OFFICIAL OPENAI DAVINCI MODEL**

const API_REVERSE_PROXY_URL = ""; // (Optional)
// Fill in if you use unofficial reverse proxy solution.
// By default this is enough

const API_ACCESS_TOKEN = ""; // Fill in if you use unofficial reverse proxy solution
const MODEL_PAID = false; // true if you subscribed ChatGPT plus and
// use unofficial reverse proxy solution

const CAPTCHA_TOKEN = ""; // (deprecated) Used by browser based solution.
const NOPECHA_TOKEN = ""; // (deprecated) Used by browser based solution.

export const Config = {
  modelName: MODEL_NAME,
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
