const dayjs = require("dayjs");
const isBetween = require("dayjs/plugin/isBetween");
dayjs.extend(isBetween);
const { isActive } = require("../config/statusManager");
const rules = require("../config/rules.json");
const { canReply } = require("./rateLimit");
const { setLastSender, getLastSender, isExpired } = require("./conversationState");

function isExcluded(number) {
    return rules.excludedNumbers.includes(number);
}

function findActiveResponse() {
    const now = dayjs();

    for (let rule of rules.responses) {
        const today = dayjs().format("YYYY-MM-DD");

        const start = dayjs(`${today} ${rule.start}`, "YYYY-MM-DD HH:mm");
        let end = dayjs(`${today} ${rule.end}`, "YYYY-MM-DD HH:mm");

        if (end.isBefore(start)) end = end.add(1, "day");

        if (now.isAfter(start) && now.isBefore(end)) {
            console.log(`⏰ Rule aktif: ${rule.id}`);
            return rule.message;
        }
    }

    console.log("⚠ Tidak ada rule yang aktif saat ini.");
    return null;
}

module.exports = async function autoReply(sock, msg) {
    const jid = msg.key.remoteJid;
    console.log("📥 Pesan masuk:", jid);

    if (
        jid.endsWith("@g.us") ||
        jid.includes("@broadcast") ||
        jid.includes("@newsletter") ||
        jid.includes("community")
    ) {
        return;
    }

    // PRIORITAS UTAMA: jika sakit aktif → balas pesan sakit
    if (isActive("sakit")) {
        const rule = rules.responses.find(r => r.id === "sakit");
        if (rule) {
            console.log("🤒 Mode SAKIT aktif → override semua rule");
            return await sock.sendMessage(jid, { text: rule.message });
        }
    }

    // PRIORITAS KEDUA: jika cuti aktif → balas pesan cuti
    if (isActive("cuti")) {
        const rule = rules.responses.find(r => r.id === "cuti");
        if (rule) {
            console.log("🏖️ Mode CUTI aktif → override semua rule");
            return await sock.sendMessage(jid, { text: rule.message });
        }
    }

    const sender = jid.replace("@s.whatsapp.net", "");

    if (isExcluded(sender)) return;

    const last = getLastSender(jid);

    if (last === "bot" && !isExpired(jid)) {
        console.log("⛔ Bot masih dianggap memulai (belum 2 jam) → auto-reply OFF");
        return;
    }

    // Jika sudah expired, reset blokir
    if (isExpired(jid)) {
        console.log("⚡ 2 jam berlalu → auto-reply kembali AKTIF");
    }

    // Tandai bahwa user yang mengirim pesan terakhir
    setLastSender(jid, "user");

    const msgText =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        null;

    if (!msgText) return;

    const reply = findActiveResponse();
    if (!reply) return;

    if (!canReply(sender)) return;

    try {
        await sock.sendMessage(jid, { text: reply });
        console.log("✅ Auto Reply terkirim ke:", sender);

    } catch (err) {
        console.log("❌ Gagal kirim auto reply:", err);
    }
};
