import plugin from "../../../lib/plugins/plugin.js";
import { Config } from "../config/config.js";

export class help extends plugin {
  constructor(e) {
    super({
      name: "ChatGPT help",
      dsc: "ChatGPT help",
      event: "message",
      priority: 500,
      rule: [
        {
          reg: "#(chatgpt|ChatGPT)(commands|命令|help|帮助|menu|菜单)",
          fnc: "help",
        },
      ],
    });
  }

  async help(e) {
    await this.reply(
      `Ask question: ?Question\n` +
        `Continuous Chatting: !Question\n` +
        ((Config.useGpt4) ? `**Chat with GPT-4**: 4Question\n` : ``) +
        `Get chats statistics: #聊天列表\n` +
        `Destroy your chat: #结束对话`,
    );
  }
}
