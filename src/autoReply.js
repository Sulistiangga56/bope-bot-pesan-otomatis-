const dayjs = require("dayjs");
const isBetween = require("dayjs/plugin/isBetween");
dayjs.extend(isBetween);

const { isActive } = require("../config/statusManager");
const rules = require("../config/rules.json");
const { canReply } = require("./rateLimit");
const {
  setLastSender,
  getLastSender,
  isExpired,
} = require("./conversationState");
const { loadRules } = require("./utils/rulesManager");

const MY_JID = "6281380036932@s.whatsapp.net";
const DEV_MODE = true;

// ================= HELPERS =================
function getConversationJid(msg) {
  return msg.key.remoteJid;
}

function getSender(msg) {
  return msg.key.participant
    ? msg.key.participant.replace("@s.whatsapp.net", "")
    : msg.key.remoteJid.replace("@s.whatsapp.net", "");
}

function isExcluded(jid) {
  const cfg = loadRules();
  return cfg.excludedJids?.includes(jid);
}

function findActiveResponse() {
  const now = dayjs();

  for (let rule of rules.responses) {
    if (!isActive(rule.id)) continue;
    if (!rule.start || !rule.end) continue;

    const today = dayjs().format("YYYY-MM-DD");
    const start = dayjs(`${today} ${rule.start}`, "YYYY-MM-DD HH:mm");
    let end = dayjs(`${today} ${rule.end}`, "YYYY-MM-DD HH:mm");

    if (end.isBefore(start)) end = end.add(1, "day");

    if (now.isAfter(start) && now.isBefore(end)) {
      return rule;
    }
  }
  return null;
}

// ================= AUTO REPLY =================
module.exports = async function autoReply(sock, msg) {
  try {
    // ===== GUARD =====
    if (!msg?.message) return;
    if (msg.key?.fromMe) return;
    if (msg.message.protocolMessage) return;
    if (msg.message.historySyncNotification) return;

    if (msg.messageTimestamp) {
      const msgTime = Number(msg.messageTimestamp) * 1000;
      if (Date.now() - msgTime > 10_000) return;
    }

    const jid = getConversationJid(msg);
    const sender = getSender(msg);

    if (
      jid.endsWith("@g.us") ||
      jid.includes("@broadcast") ||
      jid.includes("@newsletter") ||
      jid.includes("community")
    ) return;

    const isPrivateChat = jid.endsWith("@s.whatsapp.net") || jid.endsWith("@lid");

    if (!isPrivateChat) {
      console.log("⛔ Non-private chat ignored:", jid);
      return;
    }

    if (isExcluded(jid)) return;

    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text;

    if (!text) return;

    const last = getLastSender(jid);

    // ===== PRIORITAS SAKIT =====
    if (isActive("sakit")) {
      if (last === "bot" && !isExpired(jid)) return;

      const rule = rules.responses.find(r => r.id === "sakit");
      if (!rule) return;

      await sock.sendMessage(jid, { text: rule.message });
      setLastSender(jid, "bot");

      if (DEV_MODE) {
        await sock.sendMessage(MY_JID, {
          text: `🤒 SAKIT\nJID: ${jid}\nTEXT: ${text}`
        });
      }
      return;
    }

    // ===== STATE =====
    if (last === "bot" && !isExpired(jid)) return;
    if (!canReply(sender)) return;

    const rule = findActiveResponse();
    if (!rule) return;

    // ===== SEND USER =====
    await sock.sendMessage(jid, { text: rule.message });
    setLastSender(jid, "bot");

    // ===== DEBUG (AMAN) =====
    if (DEV_MODE) {
      const debugReport = `
✅ AUTO-REPLY
KE : ${jid}

🧠 Last: ${last}
💬 Pesan:
${text}

⏰ ${dayjs().format("HH:mm")}
`;
      try {
        await sock.sendMessage(MY_JID, { text: debugReport });
      } catch (_) {
        // debug gagal TIDAK BOLEH bunuh bot
      }
    }

    console.log("✅ AUTO-REPLY terkirim ke", sender);

  } catch (err) {
    console.error("❌ autoReply error:", err);
  }
};
