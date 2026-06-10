import type { SupabaseClient } from "@supabase/supabase-js";
import { generateLiveKitToken, LiveKitTokenError } from "./livekitService";

function buildSupabaseMock(handlers: {
  userId?: string;
  profile?: Record<string, unknown> | null;
  session?: Record<string, unknown> | null;
}) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn()
  };

  const supabase = {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: handlers.userId ? { user: { id: handlers.userId } } : null,
        error: handlers.userId ? null : { message: "bad token" }
      })
    },
    from: jest.fn((table: string) => {
      if (table === "kid_profiles") {
        chain.maybeSingle.mockResolvedValue({
          data: handlers.profile ?? null,
          error: null
        });
      }
      if (table === "game_sessions") {
        chain.maybeSingle.mockResolvedValue({
          data: handlers.session ?? null,
          error: null
        });
      }
      return chain;
    })
  };

  return supabase as unknown as SupabaseClient;
}

describe("generateLiveKitToken roster gate", () => {
  const prevEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...prevEnv,
      LIVEKIT_URL: "wss://lk.example.com",
      LIVEKIT_API_KEY: "key",
      LIVEKIT_API_SECRET: "secret"
    };
  });

  afterEach(() => {
    process.env = prevEnv;
  });

  it("denies voice token when kid is not in session roster (active session)", async () => {
    const supabaseAdmin = buildSupabaseMock({
      userId: "kid-a",
      profile: {
        full_name: "Kid A",
        is_active: true,
        gender: "boy",
        role: "kid"
      },
      session: {
        gender: "boy",
        player_ids: ["kid-b"],
        status: "playing"
      }
    });

    await expect(
      generateLiveKitToken({
        supabaseAdmin,
        accessToken: "token",
        sessionId: "sess-1"
      })
    ).rejects.toMatchObject<Partial<LiveKitTokenError>>({
      reason: "roster_block"
    });
  });

  it("denies voice token when kid is not in roster on paused session", async () => {
    const supabaseAdmin = buildSupabaseMock({
      userId: "kid-a",
      profile: {
        full_name: "Kid A",
        is_active: true,
        gender: "boy",
        role: "kid"
      },
      session: {
        gender: "boy",
        player_ids: ["kid-b"],
        status: "paused"
      }
    });

    await expect(
      generateLiveKitToken({
        supabaseAdmin,
        accessToken: "token",
        sessionId: "sess-1"
      })
    ).rejects.toMatchObject({ reason: "roster_block" });
  });
});
