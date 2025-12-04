require("dotenv").config();
const baileys = require("@whiskeysockets/baileys");
const { default: makeWASocket, useMultiFileAuthState } = baileys;

const autoReply = require("./autoReply");
const { setLastSender, setStartedByBot } = require("./conversationState");

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        markOnlineOnConnect: false
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message) return;

        const jid = msg.key.remoteJid;
        const text =
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            "";

        // ========================================
        // COMMAND DIPROSES DULU
        // ========================================
        if (text.startsWith("!start ")) {
            const target = text.split(" ")[1] + "@s.whatsapp.net";
            setStartedByBot(target);
            await sock.sendMessage(jid, { text: `State saved. Bot dianggap MEMULAI chat dengan ${target}` });
            return;
        }

        // ========================================
        // BARU CEK KALAU PESAN DARI BOT
        // ========================================
        if (msg.key.fromMe) {
        setLastSender(msg.key.remoteJid, "bot");
        return;
    }


        // ========================================
        // AUTO REPLY
        // ========================================
        autoReply(sock, msg);
    });

    sock.ev.on('connection.update', ({ connection }) => {
        if (connection === 'open') console.log("Bot sudah terhubung.");
        if (connection === 'close') console.log("Koneksi terputus. Reconnect...");
    });

    console.log("Bot siap menampilkan QR…");
}

module.exports = startBot;
