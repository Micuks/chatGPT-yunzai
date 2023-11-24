import _ from "lodash";
import { Bard } from "googlebard";
import { Config } from "../config/config.js";
import { HttpsProxyAgent as proxy } from "https-proxy-agent";
import nodeFetch from "node-fetch";
import { ChatGPTAPI, ChatGPTUnofficialProxyAPI } from "chatgpt";
import { error } from "console";

const CHAT_EXPIRATION = 3 * 24 * 60 * 60;
const blockWords = ["Block1", "Block2", "Block3"];

// Constants for Retry Mechanism
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const TIMEOUT_MS =
  240 * 1000 * (Config.concurrencyJobs ? Config.concurrencyJobs : 1);

export function initAPI() {
  let settings = {
    debug: false, // true for debug
  };

  let chatGPTAPI = null;

  if (Config.proxy) {
    console.log(`Using proxy ${Config.proxy} for ChatGPT`);
    settings.fetch = fetchWithProxyForChatGPTAPI;
  }

  if (Config.useUnofficial) {
    if (Config.apiReverseProxyUrl.length) {
      settings.apiReverseProxyUrl = Config.apiReverseProxyUrl;
    }
    settings.accessToken = Config.apiAccessToken;

    // Set model to be paid or free.
    if (Config.modelPaid) {
      console.log("Use paid model. Wish you were in ChatGPT plus plan!");
      if (Config.useGpt4) {
        console.log("GPT-4 enabled. Wish you were in ChatGPT plus plan!");
      } else {
        settings.model = "text-davinci-002-render-paid";
      }
    } else {
      settings.model = "text-davinci-002-render-sha";
    }

    chatGPTAPI = new ChatGPTUnofficialProxyAPI(settings);
  } else {
    if (Config.modelName.len) {
      settings.completionParams = {
        model: Config.modelName,
      };
      console.log(`Using model ${Config.modelName}`);
    }
    settings.apiKey = Config.api_key;
    chatGPTAPI = new ChatGPTAPI(settings);
  }

  return chatGPTAPI;
}

const setProxy = () => {
  if (Config.proxy) {
    console.log(`Use proxy ${Config.proxy} for bard`);
    const proxySlice = Config.proxy.split(":");
    // logger.debug(proxySlice);
    if (proxySlice.length === 3) {
      return {
        host: proxySlice[1].slice(2, proxySlice[1].length),
        port: proxySlice[2],
        protocol: "http",
      };
    } else if (proxySlice.length === 2) {
      return {
        host: proxySlice[0],
        port: proxySlice[1],
        protocol: "http",
      };
    }
  }
  return undefined;
};

class wrappedBard {
  constructor() {
    if (!Config.useBard) {
      console.log(`Bard is not enabled`);
      this.Bard = undefined;
    }

    const proxyParams = setProxy();
    const params = { proxy: proxyParams };

    this._bardCookie = Config.bardCookie;
    this._params = params;
    console.log(Config.bardCookie);
    console.log(params);
    this.Bard = new Bard(this._bardCookie, this._params);
  }

  async ask(question, conversationId) {
    if (this.Bard === undefined || this.Bard === null) {
      console.log(`Bard Instance not found. Creating new instance...`);
      this.Bard = new Bard(this._bardCookie, this._params);
    }
    try {
      let res = await this.Bard.ask(question, conversationId);
      if (this.failedBardResponse(res)) {
        console.log(
          `Error ${res} occurred, retrying... (${MAX_RETRIES} retries left)`
        );
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        return this.bardRetry(question, conversationId, MAX_RETRIES);
      }

      return res;
    } catch (err) {
      console.log(
        `Error ${err} occurred, retrying... (${MAX_RETRIES} retries left)`
      );
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      return this.bardRetry(question, conversationId, MAX_RETRIES);
    }
  }

  failedBardResponse(res) {
    switch (res) {
      case "zh":
      case "en":
      case "fr":
      case "de":
      case "SWML_DESCRIPTION_FROM_YOUR_INTERNET_ADDRESS":
      case "":
      case undefined:
      case null:
        return true;
        break;

      default:
        return false;
        break;
    }
  }

  async bardRetry(question, conversationId, retries = MAX_RETRIES) {
    // The last time of retry: reset the conversation
    const finalRetry = async (question, conversationId) => {
      console.log(`Bard conversation[${conversationId}] expired. Resetting...`);
      await this.Bard.resetConversation(conversationId);

      let res = await this.Bard.ask(question, conversationId);
      if (this.failedBardResponse(res)) {
        throw error("Max retries exceeded.");
      }

      return res;
    };

    try {
      if (retries > 1) {
        let res = await this.Bard.ask(question, conversationId);
        if (this.failedBardResponse(res)) {
          console.log(
            `Error ${res} occurred, retrying... (${retries} retries left)`
          );
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
          return this.bardRetry(question, conversationId, retries - 1);
        }

        return res;
      } else if (retries > 0) {
        return finalRetry(question, conversationId);
      } else {
        throw error(
          `Max retries exceeded for Bard conversation[${conversationId}].`
        );
      }
    } catch (err) {
      if (retries > 1) {
        console.log(
          `Error ${err} occurred, retrying... (${retries} retries left)`
        );
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        return this.bardRetry(question, conversationId, retries - 1);
      } else if (retries > 0) {
        return finalRetry(question, conversationId);
      } else {
        throw error(
          `Max retries exceeded for Bard conversation[${conversationId}]. ${err}`
        );
      }
    }
  }
}

export const initBard = () => {
  return new wrappedBard();
};

export const isChatExpired = (date) => {
  const currTime = new Date();
  return (currTime - date) / 1000 > CHAT_EXPIRATION;
};

export const isBlocked = (message) => {
  const blockWord = blockWords.find((word) =>
    message.toLowerCase().includes(word.toLowerCase())
  );
  return blockWord;
};

const fetchWithProxyForChatGPTAPI = async (url, options = {}) => {
  const proxyServer = Config.proxy;
  const defaultOptions = {
    agent: new proxy(proxyServer, { keepAlive: true, timeout: TIMEOUT_MS }),
    timeout: TIMEOUT_MS,
  };
  const mergedOptions = {
    ...defaultOptions,
    ...options,
  };
  return await fetchWithRetry(url, mergedOptions);
};

// Enhanced Fetch Function with Retry
const fetchWithRetry = async (url, options = {}, retries = MAX_RETRIES) => {
  try {
    if (retries > 0) {
      let response = await nodeFetch(url, options);
      let status_code = response.status;
      if (status_code !== 200) {
        console.log(
          `Error ${status_code} occurred, retrying... (${retries} retries left)`
        );
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        return fetchWithRetry(url, options, retries - 1);
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
      return fetchWithRetry(url, options, retries - 1);
    }

    throw error(`Max retries exceeded for ChatGPT conversation. ${err}`);
  }
};

export const chatGPTAPI = initAPI();
export const bardAPI = initBard();
