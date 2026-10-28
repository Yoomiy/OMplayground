"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.classroomAdmissionIps = exports.ClassroomAdmissionIpCache = void 0;
/** Server-only association. Never put IP evidence in LiveKit token metadata. */
class ClassroomAdmissionIpCache {
    maxEntries;
    ttlMs;
    now;
    entries = new Map();
    constructor(maxEntries = 10_000, ttlMs = 5 * 60 * 60_000, now = Date.now) {
        this.maxEntries = maxEntries;
        this.ttlMs = ttlMs;
        this.now = now;
    }
    remember(roomCode, admissionId, participantIdentity, ip) {
        this.entries.delete(admissionId);
        this.entries.set(admissionId, { roomCode, participantIdentity, ip, expiresAt: this.now() + this.ttlMs });
        while (this.entries.size > this.maxEntries)
            this.entries.delete(this.entries.keys().next().value);
    }
    lookup(roomCode, admissionId, participantIdentity) {
        const entry = admissionId ? this.entries.get(admissionId) : undefined;
        if (!entry || entry.roomCode !== roomCode || entry.participantIdentity !== participantIdentity || entry.expiresAt <= this.now()) {
            if (entry && entry.expiresAt <= this.now())
                this.entries.delete(admissionId);
            return {
                ipStatus: "unavailable", ipSource: "unavailable",
                ipObservation: "admission", ipUnavailableReason: "admission_not_cached"
            };
        }
        // Active classroom snapshots refresh the bounded association for long lessons.
        entry.expiresAt = this.now() + this.ttlMs;
        this.entries.delete(admissionId);
        this.entries.set(admissionId, entry);
        return { ...entry.ip, ipObservation: "admission" };
    }
}
exports.ClassroomAdmissionIpCache = ClassroomAdmissionIpCache;
exports.classroomAdmissionIps = new ClassroomAdmissionIpCache();
//# sourceMappingURL=classroomAdmissionIp.js.map