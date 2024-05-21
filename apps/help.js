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
          reg: "#(chatgpt|ChatGPT|chat|Chat|聊天)(commands|命令|help|帮助|menu|菜单|Help|Menu)",
          fnc: "help",
        },
      ],
    });
  }

  async help(e) {
    await this.reply(
        `询问问题: ?|!|gpt 问题\n` +
        (Config.useGpt4 ? `**和GPT-4交谈**: gpt4 问题\n` : ``) +
        (Config.useBard ? `**和Google Bard交谈**: bard 问题\n` : ``) +
        `十分钟内无交流会重置对话`
    );
  }
}
