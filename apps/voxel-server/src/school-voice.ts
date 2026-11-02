import { AccessToken, TrackSource } from "livekit-server-sdk";
import type {
  GatewayApiContext,
  GatewayOptions,
} from "../../../games/voxel/src/server/gateway.ts";
import type { VoiceToken } from "../../../games/voxel/src/shared/media.ts";
import { SchoolAccess, AccessDenied, bearerToken } from "./school-access.ts";

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

export function voiceConfig(env: Readonly<Record<string, string | undefined>>) {
  const endpoint = env.LIVEKIT_URL?.trim(),
    key = env.LIVEKIT_API_KEY?.trim(),
    secret = env.LIVEKIT_API_SECRET?.trim();
  if (!endpoint || !key || !secret || key.length > 512 || secret.length > 4096)
    throw new Error("Voice configuration required");
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new Error("Secure voice endpoint required");
  }
  if (
    !["wss:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error("Secure voice endpoint required");
  return { endpoint, key, secret };
}

/** Admission is checked once. LiveKit owns token refresh and reconnection. */
export class SchoolVoice {
  constructor(
    access: SchoolAccess,
    credentials: ReturnType<typeof voiceConfig>,
  ) {
    this.access = access;
    this.credentials = credentials;
  }
  private access: SchoolAccess;
  private credentials: ReturnType<typeof voiceConfig>;

  async issue(
    room: string,
    token: string,
    context: GatewayApiContext,
  ): Promise<VoiceToken> {
    const { subject } = await this.access.identity(token),
      actor = context.actor(room, subject.id);
    if (!actor) throw new AccessDenied("NOT_IN_ROOM");
    const hidden = actor.role === "observer";
    const credential = new AccessToken(
      this.credentials.key,
      this.credentials.secret,
      {
        identity: subject.id,
        ttl: "2h",
      },
    );
    credential.addGrant({
      roomJoin: true,
      room: `voxel-v13-${actor.worldId}-${actor.epoch}`,
      canPublish: !hidden,
      canPublishSources: hidden ? [] : [TrackSource.MICROPHONE],
      canSubscribe: true,
      canPublishData: false,
      canUpdateOwnMetadata: false,
      hidden,
    });
    return {
      token: await credential.toJwt(),
      serverUrl: this.credentials.endpoint,
      publish: !hidden,
      hidden,
    };
  }
}

export function schoolVoiceApi(
  voice: SchoolVoice,
  event: (
    name: string,
    context: Record<string, string | number | boolean>,
  ) => void,
): NonNullable<GatewayOptions["api"]> {
  return {
    "/api/voxel/voice-token": async (req, body, res, context) => {
      try {
        if (
          !body ||
          typeof body !== "object" ||
          Array.isArray(body) ||
          Object.keys(body).length !== 1 ||
          !("room" in body) ||
          typeof body.room !== "string" ||
          !UUID.test(body.room)
        )
          throw new AccessDenied("INVALID");
        const token = bearerToken(req.headers.authorization);
        if (!token) throw new AccessDenied("UNAUTHORIZED");
        if (!context) throw new AccessDenied("NOT_IN_ROOM");
        return await voice.issue(body.room, token, context);
      } catch (error) {
        const code =
          error instanceof AccessDenied ? error.code : "VOICE_UNAVAILABLE";
        event("VOXEL_VOICE_REJECTED", { code });
        res.writeHead(
          code === "INVALID"
            ? 400
            : code === "UNAUTHORIZED"
              ? 401
              : code === "VOICE_UNAVAILABLE"
                ? 503
                : 403,
          { "Content-Type": "application/json", "Cache-Control": "no-store" },
        );
        res.end(JSON.stringify({ error: code }));
        return null;
      }
    },
  };
}
