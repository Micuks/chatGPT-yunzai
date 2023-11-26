import { ChatGPTAPI, ChatGPTUnofficialProxyAPI } from "chatgpt";
import { HttpsProxyAgent } from "https-proxy-agent";
import { error } from "console";
import fetch from "node-fetch";
import { Config } from "../../config/config.js";
import Response from "../question/Response.js";

const MAX_RETRIES = 5;
const TIMEOUT_MS = 240 * Config.concurrencyJobs * 1000;
const RETRY_DELAY_MS = 1000;

class ChatGptApi {
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
   *
   * @param {string} questionBody
   * @param {object} params
   * @returns {Promise<Response>}
   */
  async ask(questionBody, params) {
    let { systemMessage, conversationId, parentMessageId, model } = params;
    this.api._model = model || this.api._model;
    let response = undefined;

    try {
      const res = await this.api.sendMessage(questionBody, params);
      console.log(res);
      response = new Response(
        res.text,
        res.parentMessageId,
        res.conversationId
      );
    } catch (err) {
      // I don't want to handle err here
      console.log(`Error asking ChatGPT: ${err}`);
      throw err;
    }

    return response;
  }

  /**
   * Fetch with proxy and retry
   * @param {string} url
   * @param {object} params
   * @param {number} retries retries left
   * @returns response
   */
  async fetch(url, params = {}, retries = MAX_RETRIES) {
    const proxyServer = Config.proxy;
    let options = {
      agent: new HttpsProxyAgent(proxyServer, {
        keepAlive: true,
        timeout: TIMEOUT_MS,
      }),
      timeout: TIMEOUT_MS,
      ...params,
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
      } else {
        throw error(`Max retries exceeded for ChatGPT conversation. ${err}`);
      }
    }

    return undefined;
  }
}

export default ChatGptApi;
