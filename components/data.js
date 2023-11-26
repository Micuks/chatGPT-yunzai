const Data = {
  getMetaInfo: async (user_id) => {
    let meta = await redis.get(`CHATGPT:META:${user_id}`);
    meta = await JSON.parse(meta);
    return meta;
  },

  setMetaInfo: async (user_id, chat) => {
    await redis.set(`CHATGPT:META:${user_id}`, JSON.stringify(chat));
  },
};

export default Data;
