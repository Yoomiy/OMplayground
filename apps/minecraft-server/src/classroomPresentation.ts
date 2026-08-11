import crypto from "crypto";

export interface PresenterCapability {
  roomCode: string;
  identity: string;
  epoch: number;
  exp: number;
}

interface ConversionTicketPayload {
  roomCode: string;
  fileName: string;
  sizeBytes: number;
  sourceFormat: "pdf" | "ppt" | "pptx";
  exp: number;
  jti: string;
}

function signPayload(payload: object, secret: string): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function verifyPayload<T>(token: string, secret: string): T | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature || !secret) return null;
  const expected = crypto.createHmac("sha256", secret).update(encoded).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
  try { return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as T; } catch { return null; }
}

export function createPresenterCapability(
  roomCode: string,
  identity: string,
  epoch: number,
  secret: string,
  ttlSeconds = 4 * 60 * 60
): string {
  return signPayload({ roomCode, identity, epoch, exp: Math.floor(Date.now() / 1000) + ttlSeconds }, secret);
}

export function readPresenterCapability(token: unknown, secret: string): PresenterCapability | null {
  if (typeof token !== "string") return null;
  const payload = verifyPayload<PresenterCapability>(token, secret);
  if (
    !payload ||
    typeof payload.roomCode !== "string" ||
    typeof payload.identity !== "string" ||
    !Number.isInteger(payload.epoch) ||
    !Number.isInteger(payload.exp) ||
    payload.exp <= Math.floor(Date.now() / 1000)
  ) return null;
  return payload;
}

export function createDocumentConversionTicket(
  payload: Omit<ConversionTicketPayload, "exp" | "jti">,
  secret: string
): string {
  return signPayload({
    ...payload,
    exp: Math.floor(Date.now() / 1000) + 5 * 60,
    jti: crypto.randomUUID()
  }, secret);
}
