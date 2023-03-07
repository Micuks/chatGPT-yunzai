import plugin from "../../../lib/plugins/plugin.js";

let helpData = [
  {
    group: "Chat",
    list: [
      {
        title: "?Question",
        desc: "Chat with me",
      },
    ],
  },
  {
    group: "Manage",
    list: [
      {
        title: "#聊天列表",
        desc: "Get chat list",
      },
    ],
  },
];

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
      `Ask question: ?Question\n` + `Continuous Chatting: !Question\n` +
        `Get chats statistics: #聊天列表\n` + `Destroy your chat: #结束对话`,
    );
  }
}
