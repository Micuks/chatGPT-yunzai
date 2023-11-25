const Data = {
  getChat: async (user_id) => {
    let chat = await redis.get(`CHATGPT:META:${user_id}`);
    return chat;
  },

  setChat: async (user_id, chat) => {
    await redis.set(`CHATGPT:META:${user_id}`, JSON.stringify(chat));
  },
};

export default Data;
