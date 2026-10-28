"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPresenterCapability = createPresenterCapability;
exports.readPresenterCapability = readPresenterCapability;
exports.createDocumentConversionTicket = createDocumentConversionTicket;
const crypto_1 = __importDefault(require("crypto"));
function signPayload(payload, secret) {
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = crypto_1.default
        .createHmac("sha256", secret)
        .update(encoded)
        .digest("base64url");
    return `${encoded}.${signature}`;
}
function verifyPayload(token, secret) {
    const [encoded, signature] = token.split(".");
    if (!encoded || !signature || !secret)
        return null;
    const expected = crypto_1.default.createHmac("sha256", secret).update(encoded).digest();
    const actual = Buffer.from(signature, "base64url");
    if (actual.length !== expected.length ||
        !crypto_1.default.timingSafeEqual(actual, expected))
        return null;
    try {
        return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    }
    catch {
        return null;
    }
}
function createPresenterCapability(roomCode, identity, epoch, secret, ttlSeconds = 4 * 60 * 60) {
    return signPayload({
        roomCode,
        identity,
        epoch,
        exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    }, secret);
}
function readPresenterCapability(token, secret) {
    if (typeof token !== "string")
        return null;
    const payload = verifyPayload(token, secret);
    if (!payload ||
        typeof payload.roomCode !== "string" ||
        typeof payload.identity !== "string" ||
        !Number.isInteger(payload.epoch) ||
        !Number.isInteger(payload.exp) ||
        payload.exp <= Math.floor(Date.now() / 1000))
        return null;
    return payload;
}
function createDocumentConversionTicket(payload, secret) {
    return signPayload({
        ...payload,
        exp: Math.floor(Date.now() / 1000) + 5 * 60,
        jti: crypto_1.default.randomUUID(),
    }, secret);
}
//# sourceMappingURL=classroomPresentation.js.map