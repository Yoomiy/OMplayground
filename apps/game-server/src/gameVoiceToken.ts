import { AccessToken, TrackSource } from "livekit-server-sdk";

export interface GameVoiceTokenResult {
  token: string;
  serverUrl: string;
  livekitRoom: string;
}

export class GameVoiceConfigError extends Error {
  constructor() {
    super("LiveKit voice chat is not configured on the game server.");
    this.name = "GameVoiceConfigError";
  }
}

export async function createGameVoiceToken(args: {
  sessionId: string;
  userId: string;
  displayName: string;
}): Promise<GameVoiceTokenResult> {
  const serverUrl = process.env.LIVEKIT_URL?.trim() ?? "";
  const apiKey = process.env.LIVEKIT_API_KEY?.trim() ?? "";
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim() ?? "";
  if (!serverUrl || !apiKey || !apiSecret) throw new GameVoiceConfigError();

  const livekitRoom = `game-session-${args.sessionId}`;
  const accessToken = new AccessToken(apiKey, apiSecret, {
    identity: args.userId,
    name: args.displayName,
    ttl: "2h"
  });
  accessToken.addGrant({
    roomJoin: true,
    room: livekitRoom,
    canPublish: true,
    canSubscribe: true,
    canPublishData: false,
    canPublishSources: [TrackSource.MICROPHONE]
  });

  return {
    token: await accessToken.toJwt(),
    serverUrl,
    livekitRoom
  };
}
