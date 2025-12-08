const baileys = require("@whiskeysockets/baileys");
const makeWASocket = baileys.default;
const { useMultiFileAuthState } = baileys;
const qrcode = require("qrcode-terminal");

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("./auth");

    const sock = makeWASocket({
        auth: state,
        browser: ["Chrome", "Windows", "10.0"], // stabil
        syncFullHistory: false, // WA iPhone wajib
        markOnlineOnConnect: false
    });

    sock.ev.on("connection.update", ({ qr, connection, lastDisconnect }) => {
        if (qr) {
            console.log("Scan QR berikut:");
            qrcode.generate(qr, { small: true });
        }

        if (connection === "open") {
            console.log("Bot connected!");
        }

        if (connection === "close") {
            console.log("Terputus. Reconnect...");
            startBot();
        }
    });

    sock.ev.on("creds.update", saveCreds);
}

module.exports = startBot;
