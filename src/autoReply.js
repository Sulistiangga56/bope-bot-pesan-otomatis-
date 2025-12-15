const dayjs = require("dayjs");
const isBetween = require("dayjs/plugin/isBetween");
dayjs.extend(isBetween);
const { isActive } = require("../config/statusManager");
const rules = require("../config/rules.json");
const { canReply } = require("./rateLimit");
const { setLastSender, getLastSender, isExpired } = require("./conversationState");
const { loadRules } = require("./utils/rulesManager");

function isExcluded(jid) {
    const rules = loadRules();
    return rules.excludedJids?.includes(jid);
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

    function getSender(msg) {
        return msg.key.participant
            ? msg.key.participant.replace("@s.whatsapp.net", "")
            : msg.key.remoteJid.replace("@s.whatsapp.net", "");
    }

    const sender = getSender(msg);

    console.log("📥 PESAN MASUK");
    console.log("   JID     :", jid);
    console.log("   SENDER  :", sender);

    // ===============================
    // FILTER GROUP / BROADCAST
    // ===============================
    if (
        jid.endsWith("@g.us") ||
        jid.includes("@broadcast") ||
        jid.includes("@newsletter") ||
        jid.includes("community")
    ) {
        console.log("⛔ Pesan dari group/broadcast → DIABAIKAN");
        return;
    }

    // ===============================
    // DEBUG EXCLUDED
    // ===============================
    if (isExcluded(sender)) {
        console.log("🚫 NOMOR TERMASUK EXCLUDED");
        console.log("   BLOCK AUTO-REPLY UNTUK:", sender);
        return;
    } else {
        console.log("✅ Nomor TIDAK termasuk excluded");
    }

    // ===============================
    // PRIORITAS STATUS
    // ===============================
    if (isActive("sakit")) {
        console.log("🤒 Mode SAKIT aktif");
        const rule = rules.responses.find(r => r.id === "sakit");
        if (rule) {
            await sock.sendMessage(jid, { text: rule.message });
            console.log("📤 Auto-reply SAKIT terkirim ke", sender);
        }
        return;
    }

    if (isActive("cuti")) {
        console.log("🏖️ Mode CUTI aktif");
        const rule = rules.responses.find(r => r.id === "cuti");
        if (rule) {
            await sock.sendMessage(jid, { text: rule.message });
            console.log("📤 Auto-reply CUTI terkirim ke", sender);
        }
        return;
    }

    // ===============================
    // CEK STATE PERCAKAPAN
    // ===============================
    const last = getLastSender(jid);
    console.log("🧠 Last sender state:", last);

    if (last === "bot" && !isExpired(jid)) {
        console.log("⛔ Bot masih dianggap memulai (belum expired)");
        return;
    }

    if (isExpired(jid)) {
        console.log("⏰ State expired → auto-reply diaktifkan lagi");
    }

    setLastSender(jid, "user");

    // ===============================
    // CEK TEKS PESAN
    // ===============================
    const msgText =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        null;

    if (!msgText) {
        console.log("⚠ Pesan tanpa teks → DIABAIKAN");
        return;
    }

    console.log("💬 Isi pesan:", msgText);

    // ===============================
    // CEK RULE AKTIF
    // ===============================
    const reply = findActiveResponse();

    if (!reply) {
        console.log("⚠ Tidak ada rule aktif saat ini");
        return;
    }

    // ===============================
    // RATE LIMIT
    // ===============================
    if (!canReply(sender)) {
        console.log("⛔ Rate limit aktif untuk", sender);
        return;
    }

    // ===============================
    // KIRIM AUTO-REPLY
    // ===============================
    const senderJid = msg.key.participant || msg.key.remoteJid;
    if (isExcluded(senderJid)) {
    console.log("🚫 JID DI-EXCLUDE:", senderJid);
    return;
    }
    const debugReport = `
✅ AUTO-REPLY TERKIRIM
KE : ${senderJid}

📥 PESAN MASUK
JID     : ${jid}
SENDER  : ${senderJid}

✅ Nomor TIDAK termasuk excluded
🧠 Last sender state: ${last}

💬 Isi pesan:
${msgText}

⏰ Rule aktif: ${dayjs().format("HH:mm")} (${reply ? "AKTIF" : "TIDAK AKTIF"})
`;
    try {
        const MY_JID = "6281380036932@s.whatsapp.net";

        // ke user
        await sock.sendMessage(jid, { text: reply });

        //ke dev
        await sock.sendMessage(MY_JID, { text: debugReport });
        console.log("✅ AUTO-REPLY TERKIRIM");
        console.log("   KE :", sender);

    } catch (err) {
        console.log("❌ Gagal kirim auto reply:", err);
    }
};