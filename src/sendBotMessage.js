const { setLastSender } = require("./conversationState");

module.exports = async function sendBotMessage(sock, jid, content) {
    await sock.sendMessage(jid, content);
    setLastSender(jid, "bot");
};