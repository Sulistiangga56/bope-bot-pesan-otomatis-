const fs = require("fs");
const path = require("path");

const RULES_PATH = path.join(__dirname, "../../config/rules.json");

function loadRules() {
    delete require.cache[require.resolve(RULES_PATH)];
    return JSON.parse(fs.readFileSync(RULES_PATH, "utf8"));
}

function saveRules(rules) {
    fs.writeFileSync(RULES_PATH, JSON.stringify(rules, null, 2));
}

// ===============================
// EXCLUDE MANAGER
// ===============================
function addExcludedJid(jid) {
    const rules = loadRules();
    rules.excludedJids ||= [];

    if (rules.excludedJids.includes(jid)) {
        return { success: false, reason: "EXISTS" };
    }

    rules.excludedJids.push(jid);
    saveRules(rules);
    return { success: true };
}

function removeExcludedJid(jid) {
    const rules = loadRules();
    rules.excludedJids ||= [];

    const index = rules.excludedJids.indexOf(jid);
    if (index === -1) {
        return { success: false, reason: "NOT_FOUND" };
    }

    rules.excludedJids.splice(index, 1);
    saveRules(rules);
    return { success: true };
}

function resetExcludedJids() {
    const rules = loadRules();
    rules.excludedJids = [];
    saveRules(rules);
    return true;
}

function listExcludedJids() {
    const rules = loadRules();
    return rules.excludedJids || [];
}

module.exports = {
    loadRules,
    addExcludedJid,
    removeExcludedJid,
    resetExcludedJids,
    listExcludedJids
};
