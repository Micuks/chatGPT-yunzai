import plugin from "../../../lib/plugins/plugin.js";
import { Config } from "../config/runtime.js";

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
    const providers = (Config.modelProviders || []).filter(
      (item) => item && item.enabled !== false
    );
    const providerNames = providers.map((item) => item.name).join(" / ");
    const triggerHints = providers
      .map((item) => {
        const triggers = Array.isArray(item.triggers)
          ? item.triggers
          : item.rawTriggers;
        if (!Array.isArray(triggers) || triggers.length === 0) return null;
        const samples = triggers
          .map((token) => (typeof token === "string" ? token : null))
          .filter(Boolean)
          .slice(0, 3);
        if (!samples.length) return null;
        return `${item.name}: ${samples.join(", ")}`;
      })
      .filter(Boolean);

    const parts = [
      "询问问题: ? | ! | gpt + 内容，或直接 @ 机器人提问",
      "十分钟内无交流会重置对话",
      "使用 #模型设置 查看并切换可用模型" +
        (providerNames ? `（当前可选：${providerNames}）` : "")
    ];

    if (triggerHints.length) {
      parts.push("", "触发词示例:", ...triggerHints);
    }

    await this.reply(parts.join("\n"));
  }
}
