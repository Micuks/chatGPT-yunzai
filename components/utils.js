import _ from "lodash";
import { Bard } from "googlebard";
import { Config } from "../config/config.js";
import { HttpsProxyAgent as proxy } from "https-proxy-agent";
import nodeFetch from "node-fetch";
import { ChatGPTAPI, ChatGPTUnofficialProxyAPI } from "chatgpt";
import https from "https";

const CHAT_EXPIRATION = 3 * 24 * 60 * 60;
const blockWords = ["Block1", "Block2", "Block3"];

// Constants for Retry Mechanism
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const TIMEOUT_MS = 60 * 1000;

export function initAPI() {
  let settings = {
    debug: false, // true for debug
  };

  let chatGPTAPI = null;

  if (Config.proxy) {
    logger.info(`Using proxy ${Config.proxy} for ChatGPT`);
    settings.fetch = fetchWithProxyForChatGPTAPI;
  }

  if (Config.useUnofficial) {
    if (Config.apiReverseProxyUrl.length) {
      settings.apiReverseProxyUrl = Config.apiReverseProxyUrl;
    }
    settings.accessToken = Config.apiAccessToken;

    // Set model to be paid or free.
    if (Config.modelPaid) {
      logger.info("Use paid model. Wish you were in ChatGPT plus plan!");
      if (Config.useGpt4) {
        logger.info("GPT-4 enabled. Wish you were in ChatGPT plus plan!");
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
      logger.info(`Using model ${Config.modelName}`);
    }
    settings.apiKey = Config.api_key;
    chatGPTAPI = new ChatGPTAPI(settings);
  }

  return chatGPTAPI;
}

const setProxy = () => {
  if (Config.proxy) {
    logger.info(`Use proxy ${Config.proxy} for bard`);
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

export const initBard = () => {
  if (!Config.useBard) {
    logger.info(`Bard is not enabled`);
    return;
  }

  const proxyParams = setProxy();
  const params = { proxy: proxyParams };
  return new Bard(Config.bardCookie, params);
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
    return await nodeFetch(url, options);
  } catch (err) {
    if (retries > 0 && err.type === "request-timeout") {
      logger.warn("Timeout occurred, retrying... (${retries} retries left)");
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      return fetchWithRetry(url, options, retries - 1);
    }
    throw err;
  }
};
