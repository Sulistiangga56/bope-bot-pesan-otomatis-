const lastReply = {}; 
// Format: lastReply[number] = timestamp terakhir bot membalas

function canReply(sender) {
    const now = Date.now();

    if (!lastReply[sender]) {
        lastReply[sender] = now;
        return true; // belum pernah dibalas → balas
    }

    const diff = now - lastReply[sender];
    const oneHour = 60 * 60 * 1000; // 1 jam

    if (diff >= oneHour) {
        lastReply[sender] = now;
        return true; // sudah lewat 1 jam → balas lagi
    }

    return false; // belum 1 jam → jangan balas
}

module.exports = { canReply };
