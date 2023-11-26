import { ChatGPTAPI, ChatGPTUnofficialProxyAPI } from "chatgpt";
import { error } from "console";
import fetch from "node-fetch";
import { Config } from "../../config/config.js";

const MAX_RETRIES = 5;
const TIMEOUT_MS = 240 * Config.concurrencyJobs * 1000;
const RETRY_DELAY_MS = 1000;

class ChatGPTAPI {
  constructor() {
    let params = { fetch: this.fetch };

    this.gpt4 = Config.useGpt4;

    if (Config.useUnofficial) {
      params.accessToken = Config.apiAccessToken;
      params.apiReverseProxyUrl = Config.apiReverseProxyUrl;
      this.mode = "unofficial";
      this.api = new ChatGPTUnofficialProxyAPI(params);
    } else {
      params.apiKey = Config.api_key;
      this.mode = "official";
      this.api = new ChatGPTAPI(params);
    }
  }

  /**
   * Fetch with proxy and retry
   * @param {string} url
   * @param {object} options
   * @param {number} retries retries left
   * @returns response
   */
  async fetch(url, options = {}, retries = MAX_RETRIES) {
    const proxyServer = Config.proxy;
    let options = {
      agent: new proxy(proxyServer, { keepAlive: true, timeout: TIMEOUT_MS }),
      timeout: TIMEOUT_MS,
      ...options,
    };

    try {
      if (retries > 0) {
        let response = await fetch(url, options);
        let status_code = response.status;
        if (status_code !== 200) {
          console.log(
            `Error ${status_code} occurred, retrying... (${retries} retries left)`
          );
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
          return fetch(url, options, retries - 1);
        }

        return response;
      } else {
        throw error(`Max retries exceeded for ChatGPT conversation.`);
      }
    } catch (err) {
      if (retries > 0) {
        // err.type === "request-timeout"
        console.log(
          `Error ${err} occurred, retrying... (${retries} retries left)`
        );
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        return fetch(url, options, retries - 1);
      }

      throw error(`Max retries exceeded for ChatGPT conversation. ${err}`);
    }

    return false;
  }
}

export default ChatGPTAPI;
