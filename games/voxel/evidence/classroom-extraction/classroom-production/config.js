"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readClassroomConfig = readClassroomConfig;
function readClassroomConfig(env = process.env) {
    const port = Number(env.PORT ?? 8083);
    const ipSource = env.CLASSROOM_CLIENT_IP_SOURCE ?? "unavailable";
    const supabaseUrl = env.SUPABASE_URL?.trim() ?? "";
    const signingSecret = env.SUPABASE_SECRET_KEY?.trim() ?? "";
    const livekitUrl = env.LIVEKIT_URL?.trim() ?? "";
    const livekitApiKey = env.LIVEKIT_API_KEY?.trim() ?? "";
    const livekitApiSecret = env.LIVEKIT_API_SECRET?.trim() ?? "";
    const documentConverterUrl = (env.DOCUMENT_CONVERTER_URL ?? "http://localhost:8082").replace(/\/$/, "");
    if (!Number.isInteger(port) || port < 0 || port > 65535)
        throw new Error("Invalid classroom port");
    if (!["railway", "direct", "unavailable"].includes(ipSource))
        throw new Error("Invalid CLASSROOM_CLIENT_IP_SOURCE");
    const validUrl = (value, protocols) => {
        try {
            const url = new URL(value);
            return (protocols.includes(url.protocol) &&
                !url.username &&
                !url.password &&
                !url.search &&
                !url.hash);
        }
        catch {
            return false;
        }
    };
    if (!validUrl(supabaseUrl, ["https:", "http:"]) ||
        !signingSecret.startsWith("sb_secret_")) {
        throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY are required");
    }
    if (!validUrl(livekitUrl, ["wss:", "ws:", "https:", "http:"]) ||
        !livekitApiKey ||
        !livekitApiSecret) {
        throw new Error("LiveKit configuration is required");
    }
    if (!validUrl(documentConverterUrl, ["https:", "http:"]))
        throw new Error("Invalid document converter URL");
    const corsOrigin = env.CORS_ORIGIN ?? "http://localhost:5173,http://127.0.0.1:5173";
    if (!corsOrigin
        .split(",")
        .every((value) => validUrl(value.trim(), ["https:", "http:"]) &&
        new URL(value.trim()).pathname === "/")) {
        throw new Error("Invalid CORS_ORIGIN");
    }
    return Object.freeze({
        port,
        host: env.HOST ?? "0.0.0.0",
        corsOrigin,
        ipSource: ipSource,
        supabaseUrl,
        signingSecret,
        livekitUrl,
        livekitApiKey,
        livekitApiSecret,
        documentConverterUrl,
        documentConverterSecret: env.DOCUMENT_CONVERTER_SHARED_SECRET ?? "",
    });
}
//# sourceMappingURL=config.js.map