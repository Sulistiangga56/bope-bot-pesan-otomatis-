require("dotenv").config();
const baileys = require("@whiskeysockets/baileys");
const { default: makeWASocket, useMultiFileAuthState } = baileys;
const { setStatus } = require("../config/statusManager");
const autoReply = require("./autoReply");
const { setLastSender, setStartedByBot } = require("./conversationState");

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        syncFullHistory: true,
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

        const sender = jid.replace("@s.whatsapp.net", "");

        // Hanya kamu yang bisa mengubah status!
        const OWNER = "6281380036932"; // nomor kamu

        // ===========================================
        // COMMAND: !sakit on/off, !cuti on/off
        // ===========================================
        if (sender === OWNER && text.startsWith("!")) {
            
            console.log("COMMAND DARI OWNER:", text);
            const [cmd, mode] = text.slice(1).split(" ");
            console.log("CMD =", cmd, "MODE =", mode);

            if (["pagi", "istirahat", "siang", "pulang", "malam", "sakit", "cuti"].includes(cmd) && ["on", "off"].includes(mode)) {
                const active = mode === "on";
                setStatus(cmd, active);

                await sock.sendMessage(jid, {
                    text: `Rule *${cmd}* sekarang: *${active ? "AKTIF" : "NON-AKTIF"}*`
                });

                return;
            }
        }

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
