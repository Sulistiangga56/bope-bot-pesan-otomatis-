const fs = require('fs');
const path = './conversationState.json';

function loadState() {
    if (!fs.existsSync(path)) return {};
    return JSON.parse(fs.readFileSync(path));
}

function saveState(state) {
    fs.writeFileSync(path, JSON.stringify(state, null, 2));
}

const state = loadState();

// Simpan pengirim terakhir + waktu
function setLastSender(jid, sender) {
    if (!state[jid]) state[jid] = {};
    state[jid].lastSender = sender;   // "bot" atau "user"
    state[jid].lastUpdate = new Date().toISOString();
    saveState(state);
}

function getLastSender(jid) {
    return state[jid]?.lastSender || null;
}

function getLastUpdate(jid) {
    return state[jid]?.lastUpdate || null;
}

// Cek apakah sudah lewat 2 jam
function isExpired(jid) {
    const last = getLastUpdate(jid);
    if (!last) return true;

    const diffMs = Date.now() - new Date(last).getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    return diffHours >= 2; // expire setelah 2 jam
}

module.exports = {
    setLastSender,
    getLastSender,
    getLastUpdate,
    isExpired
};
