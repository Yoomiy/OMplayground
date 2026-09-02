import { TokenVerifier } from "livekit-server-sdk";
import { createGameVoiceToken, GameVoiceConfigError } from "./gameVoiceToken";

describe("createGameVoiceToken", () => {
  const previousEnv = process.env;
  const apiKey = "key";
  const apiSecret = "secret-that-is-long-enough-for-hmac";

  afterEach(() => {
    process.env = previousEnv;
  });

  it("scopes an audio-capable token to the shared game session", async () => {
    process.env = {
      ...previousEnv,
      LIVEKIT_URL: "wss://lk.example.com",
      LIVEKIT_API_KEY: apiKey,
      LIVEKIT_API_SECRET: apiSecret
    };

    const result = await createGameVoiceToken({
      sessionId: "session-1",
      userId: "kid-1",
      displayName: "Kid One"
    });
    const claims = await new TokenVerifier(apiKey, apiSecret).verify(result.token);

    expect(result.serverUrl).toBe("wss://lk.example.com");
    expect(result.livekitRoom).toBe("game-session-session-1");
    expect(claims.sub).toBe("kid-1");
    expect(claims.name).toBe("Kid One");
    expect(claims.video?.room).toBe("game-session-session-1");
    expect(claims.video?.roomJoin).toBe(true);
    expect(claims.video?.canPublish).toBe(true);
    expect(claims.video?.canSubscribe).toBe(true);
    expect(claims.video?.canPublishData).toBe(false);
    expect(claims.video?.canPublishSources).toEqual(["microphone"]);
  });

  it("fails closed when the game server has no LiveKit credentials", async () => {
    process.env = { ...previousEnv };
    delete process.env.LIVEKIT_URL;
    delete process.env.LIVEKIT_API_KEY;
    delete process.env.LIVEKIT_API_SECRET;

    await expect(
      createGameVoiceToken({
        sessionId: "session-1",
        userId: "kid-1",
        displayName: "Kid One"
      })
    ).rejects.toBeInstanceOf(GameVoiceConfigError);
  });
});
