import _ from 'lodash'

const blockWords = ['Block1', 'Block2', 'Block3']

export const isChatExpired = (date) => {
  const currTime = new Date()
  return (currTime - date) / 1000 > CHAT_EXPIRATION
}

export const isBlocked = (message) => {
  const blockWord = blockWords.find((word) =>
    message.toLowerCase().includes(word.toLowerCase())
  )
  return blockWord
}
