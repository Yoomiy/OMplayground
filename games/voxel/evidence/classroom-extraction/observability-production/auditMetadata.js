"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditMetadata = auditMetadata;
/** Merge correlation_id into audit_log metadata (Option 1 — no schema column). */
function auditMetadata(correlationId, extra) {
    const base = extra ? { ...extra } : {};
    if (correlationId?.trim()) {
        base.correlation_id = correlationId.trim();
    }
    return base;
}
//# sourceMappingURL=auditMetadata.js.map