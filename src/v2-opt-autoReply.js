const dayjs = require("dayjs");
const isBetween = require("dayjs/plugin/isBetween");
dayjs.extend(isBetween);

const { isActive } = require("../config/statusManager");
const rules = require("../config/rules.json");
const { canReply } = require("./rateLimit");
const { setLastSender, getLastSender, isExpired } = require("./conversationState");

// HANYA izinkan JID user WA asli
function isValidUserJid(jid) {
    return jid.endsWith("@s.whatsapp.net");
}

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

    // ⛔ Tolak JID yang bukan user (WA Channels, bisnis, interop, lid, group, dsb.)
    if (!isValidUserJid(jid)) {
        console.log("⛔ JID bukan user WA normal → abaikan:", jid);
        return;
    }

    // Ambil nomor pengirim
    const sender = jid.replace("@s.whatsapp.net", "");

    // PRIORITAS 1 — Mode Sakit
    if (isActive("sakit")) {
        const rule = rules.responses.find(r => r.id === "sakit");
        if (rule) {
            console.log("🤒 Mode SAKIT aktif → override semua rule");
            return sock.sendMessage(jid, { text: rule.message });
        }
    }

    // PRIORITAS 2 — Mode Cuti
    if (isActive("cuti")) {
        const rule = rules.responses.find(r => r.id === "cuti");
        if (rule) {
            console.log("🏖️ Mode CUTI aktif → override semua rule");
            return sock.sendMessage(jid, { text: rule.message });
        }
    }

    // Abaikan nomor exclude
    if (isExcluded(sender)) return;

    const last = getLastSender(jid);

    // Jika bot yang terakhir chat dan belum 2 jam → jangan balas
    if (last === "bot" && !isExpired(jid)) {
        console.log("⛔ Bot yang terakhir membalas (belum 2 jam)");
        return;
    }

    // Jika expired → reset
    if (isExpired(jid)) {
        console.log("⚡ 2 jam berlalu → auto-reply kembali AKTIF");
    }

    // Tandai user sebagai pengirim terakhir
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
        setLastSender(jid, "bot");
        console.log("✅ Auto Reply terkirim ke:", sender);

    } catch (err) {
        console.log("❌ Gagal kirim auto reply:", err);
    }
};
