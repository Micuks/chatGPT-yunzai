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
          reg:
            "#(chatgpt|ChatGPT|chat|Chat|聊天)(commands|命令|help|帮助|menu|菜单)",
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
        ((Config.useBard) ? `**Chat with Bard**: BQuestion\n` : ``) +
        `Get chats statistics: #聊天列表\n` +
        `Destroy your chat: #结束对话\n\n` +
        `询问问题: ?问题\n` +
        `连续对话: !问题\n` +
        ((Config.useGpt4) ? `**和GPT-4交谈**: 4问题\n` : ``) +
        ((Config.useBard) ? `**和Google Bard交谈**: B问题\n` : ``) +
        `获取聊天统计[管理员]: #聊天列表\n` +
        `删除当前对话: #结束对话`,
    );
  }
}
