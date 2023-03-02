const CHAT_EXPIRATION = 3 * 24 * 60 * 60;
const blockWords = ["Block1", "Block2", "Block3"];

const isChatExpired = (date) => {
  const currTime = new Date();
  return (currTime - date) / 1000 > CHAT_EXPIRATION;
};

const isBlocked = (message) => {
  const blockWord = blockWords.find((word) =>
    message.toLowerCase().includes(word.toLowerCase())
  );
  return blockWord;
};
