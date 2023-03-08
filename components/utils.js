import { Config } from "../config/config.js";
import proxy from "https-proxy-agent";
import nodeFetch from "node-fetch";
import { ChatGPTAPI, ChatGPTUnofficialProxyAPI } from "chatgpt";

const CHAT_EXPIRATION = 3 * 24 * 60 * 60;
const blockWords = ["Block1", "Block2", "Block3"];

export function initAPI() {
  let settings = {
    debug: false, // true for debug
  };

  let chatGPTAPI = null;

  if (Config.useUnofficial) {
    if (Config.proxy) {
      logger.info(`Using proxy ${Config.proxy} for unofficial API`);
      settings.fetch = fetchWithProxyForUnofficialProxyAPI;
    }
    if (Config.apiReverseProxyUrl.length) {
      settings.apiReverseProxyUrl = Config.apiReverseProxyUrl;
    }
    settings.accessToken = Config.apiAccessToken;

    // Set model to be paid or free.
    if (Config.modelPaid) {
      logger.info("Use paid model. Wish you were in ChatGPT plus plan!");
      settings.completionParams = {
        model: "text-davinci-002-render-paid",
      };
    } else {
      settings.completionParams = {
        model: "text-davinci-002-render-sha",
      };
    }

    chatGPTAPI = new ChatGPTUnofficialProxyAPI(settings);
  } else {
    if (Config.proxy) {
      logger.info(`Using proxy ${Config.proxy} for official API`);
      settings.fetch = fetchWithProxyForChatGPTAPI;
    }
    if (Config.modelName.len) {
      settings.completionParams = {
        model: Config.modelName,
      };
      logger.info(`Using model ${Config.modelName}`);
    }
    settings.apiKey = Config.api_key;
    chatGPTAPI = new ChatGPTAPI(settings);
  }

  redis.set("CHATGPT:API_SETTINGS", JSON.stringify(settings));

  return chatGPTAPI;
}

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

const fetchWithProxyForChatGPTAPI = (url, options = {}) => {
  const proxyServer = Config.proxy;
  const defaultOptions = {
    agent: proxy(proxyServer),
  };
  const mergedOptions = {
    ...defaultOptions,
    ...options,
  };
  return nodeFetch(url, mergedOptions);
};

const fetchWithProxyForUnofficialProxyAPI = (url, options = {}) => {
  const proxyServer = Config.proxy;
  return nodeFetch(url, {
    ...options,
    headers: {
      ...options.headers,
      // "keep-alive": "timeout=360",
      accept: "text/event-stream",
    },
    keepalive: true,
    agent: proxy(proxyServer),
  });
};
