require("dotenv").config();
const baileys = require("@whiskeysockets/baileys");
const makeWASocket = baileys.default;
const { useMultiFileAuthState } = baileys;
const qrcode = require("qrcode-terminal");
const { setStatus } = require("../config/statusManager");
const autoReply = require("./autoReply");
const { setLastSender, setStartedByBot } = require("./conversationState");

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth');

    const sock = makeWASocket({
        auth: state,
        browser: ["Chrome", "Windows", "10.0"], // stabil
        syncFullHistory: false,
        markOnlineOnConnect: false
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", ({ qr, connection, lastDisconnect }) => {
        if (qr) {
            console.log("Scan QR berikut:");
            qrcode.generate(qr, { small: true });
        }

        if (connection === "open") {
            console.log("Bot sudah terhubung.");
        }

        if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode;
            console.log("Koneksi terputus. Reason:", reason);

            // Auto reconnect kecuali logout dari perangkat
            if (reason !== 401) {
                console.log("Mencoba reconnect otomatis…");
                startBot();
            } else {
                console.log("Session dihapus/Logout. Scan ulang QR.");
            }
        }
    });

    sock.ev.on("messages.upsert", async ({ messages, type }) => {
        if (type !== "notify") return;

        const msg = messages[0];
        if (!msg.message) return;

        if (msg.messageTimestamp < Math.floor(Date.now() / 1000) - 10) {
            return;
        }

        const jid = msg.key.remoteJid;
        const text =
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            "";

        const sender = jid.replace("@s.whatsapp.net", "");

        const {
            addExcludedJid,
            removeExcludedJid,
            resetExcludedJids,
            listExcludedJids
        } = require("./utils/rulesManager");
        // Hanya kamu yang bisa mengubah status!
        const OWNER = "6281380036932"; // nomor kamu

        if (sender === OWNER && text.startsWith("!exclude")) {
        const args = text.split(" ");

        // ===============================
        // !exclude list
        // ===============================
        if (args[1] === "list") {
            const list = listExcludedJids();

            if (list.length === 0) {
                await sock.sendMessage(jid, { text: "📭 Excluded list kosong." });
                return;
            }

            await sock.sendMessage(jid, {
                text:
                    "🚫 *DAFTAR EXCLUDED JID*\n\n" +
                    list.map((j, i) => `${i + 1}. ${j}`).join("\n")
            });
            return;
        }

        // ===============================
        // !exclude reset
        // ===============================
        if (args[1] === "reset") {
            resetExcludedJids();
            await sock.sendMessage(jid, {
                text: "♻️ Semua excluded JID berhasil dihapus."
            });
            return;
        }

        // ===============================
        // !exclude add <jid>
        // ===============================
        if (args[1] === "add" && args[2]) {
            const target = args[2];

            const result = addExcludedJid(target);

            if (!result.success) {
                await sock.sendMessage(jid, {
                    text: `⚠️ JID sudah ada:\n${target}`
                });
                return;
            }

            await sock.sendMessage(jid, {
                text: `✅ JID berhasil di-exclude:\n${target}`
            });
            return;
        }

        // ===============================
        // !exclude remove <jid>
        // ===============================
        if (args[1] === "remove" && args[2]) {
            const target = args[2];
            const result = removeExcludedJid(target);

            if (!result.success) {
                await sock.sendMessage(jid, {
                    text: `❌ JID tidak ditemukan:\n${target}`
                });
                return;
            }

            await sock.sendMessage(jid, {
                text: `✅ JID berhasil dihapus dari exclude:\n${target}`
            });
            return;
        }

        // ===============================
        // HELP
        // ===============================
        await sock.sendMessage(jid, {
            text:
    `📌 *EXCLUDE COMMAND*
    !exclude add <jid>
    !exclude remove <jid>
    !exclude list
    !exclude reset`
        });
        return;
    }

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

    console.log("Bot siap menampilkan QR…");
}

module.exports = startBot;
