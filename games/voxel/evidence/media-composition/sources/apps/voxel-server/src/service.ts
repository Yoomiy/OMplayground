import { createLogger } from "@playground/observability/dist/logger.js";
import {
  createSupabaseServerClient,
  SupabasePersistence,
} from "./supabase-persistence.ts";
import { SupabaseSessions } from "./supabase-sessions.ts";
import { SupabaseControls, schoolControl } from "./school-control.ts";
import { schoolGatewayPolicy } from "./school-admission.ts";
import { SchoolAccess } from "./school-access.ts";
import { loadServerRelease } from "./release.ts";
import { SupabaseStaff, schoolStaff } from "./school-staff.ts";
import {
  SupabaseModeration,
  schoolModerationApi,
} from "./school-moderation.ts";
import { schoolRosterApi } from "./school-roster.ts";
import { schoolSessionApi } from "./school-session.ts";
import { SupabaseChat, schoolChatApi } from "./school-chat.ts";
import {
  SupabaseMedia,
  SchoolVoice,
  schoolMediaApi,
  voiceConfig,
} from "./school-media.ts";
import { VoiceSignaling } from "./voice-signaling.ts";
export type ServiceLogger = Pick<
  ReturnType<typeof createLogger>,
  "info" | "error"
>;
export function serviceConfig(
  env: Readonly<Record<string, string | undefined>>,
) {
  const originText = env.VOXEL_ALLOWED_ORIGINS?.trim();
  if (!originText) throw new Error("VOXEL_ALLOWED_ORIGINS is required");
  const origins = [
    ...new Set(originText.split(",").map((value) => value.trim())),
  ];
  for (const text of origins) {
    let url: URL;
    try {
      url = new URL(text);
    } catch {
      throw new Error("invalid voxel origin");
    }
    if (
      url.origin !== text ||
      url.username ||
      url.password ||
      !(
        url.protocol === "https:" ||
        (env.NODE_ENV !== "production" &&
          url.protocol === "http:" &&
          ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
      )
    )
      throw new Error("invalid voxel origin");
  }
  const portText = env.PORT ?? "3001",
    port = Number(portText),
    host = env.VOXEL_HOST ?? "0.0.0.0";
  if (
    !/^\d+$/.test(portText) ||
    !Number.isSafeInteger(port) ||
    port < (env.NODE_ENV === "test" ? 0 : 1) ||
    port > 65535 ||
    !/^[a-zA-Z0-9._:\[\]-]{1,253}$/.test(host)
  )
    throw new Error("invalid voxel listener");
  return { port, host, origins };
}
/** Startup never listens before artifacts and all service-only schemas verify. */
export async function startVoxelService(
  options: {
    env?: Readonly<Record<string, string | undefined>>;
    request?: typeof fetch;
    logger?: ServiceLogger;
    gameRoot?: URL;
  } = {},
) {
  const env = options.env ?? process.env,
    config = serviceConfig(env),
    logger = options.logger ?? createLogger("voxel-server");
  const runtime = await loadServerRelease(options.gameRoot),
    client = createSupabaseServerClient(env, options.request),
    backend = new SupabasePersistence(client),
    sessions = new SupabaseSessions(client),
    commands = new SupabaseControls(client),
    staff = new SupabaseStaff(client),
    moderation = new SupabaseModeration(client),
    chat = new SupabaseChat(client),
    media = new SupabaseMedia(client),
    access = new SchoolAccess(client);
  const readiness = await Promise.allSettled([
    backend.verifyInstallation(),
    sessions.verifyInstallation(),
    sessions.verifyRosterInstallation(),
    commands.verifyInstallation(),
    staff.verifyInstallation(),
    moderation.verifyInstallation(),
    chat.verifyInstallation(),
    media.verifyInstallation(),
  ]);
  for (const status of readiness)
    if (status.status === "rejected") throw status.reason;
  const event = (
    name: string,
    context: Record<string, string | number | boolean>,
  ) => {
    const failed =
      name.endsWith("_FAILED") ||
      name.endsWith("_REJECTED") ||
      name.endsWith("_UNAVAILABLE");
    const { correlationId, ...details } = context;
    logger[failed ? "error" : "info"]({
      ...(typeof correlationId === "string" ? { correlationId } : {}),
      message: "Voxel service event",
      protocol: "internal",
      context: {
        event: name,
        status: failed ? "failed" : "success",
        ...details,
      },
    });
  };
  const credentials = voiceConfig(env),
    signal = new VoiceSignaling(credentials.endpoint, config.origins);
  let gateway: Awaited<ReturnType<typeof runtime.createGateway>>;
  try {
    await signal.ready;
    const voice = new SchoolVoice(access, media, signal, credentials);
    gateway = await runtime.createGateway({
      build: runtime.build,
      content: runtime.content,
      host: config.host,
      port: config.port,
      allowedOrigins: config.origins,
      worldDefaults: { mode: "survival" },
      persistence: { objects: backend, metadata: backend },
      ...schoolGatewayPolicy(access, sessions),
      control: (req, body, res) =>
        body && typeof body === "object" && "command" in body
          ? schoolStaff(access, staff, event)(req, body, res)
          : schoolControl(access, commands, event)(req, body, res),
      api: {
        ...schoolSessionApi(access, client, event),
        ...schoolRosterApi(access, client, event),
        ...schoolModerationApi(access, moderation, event),
        ...schoolChatApi(access, chat, event),
        ...schoolMediaApi(access, media, voice, signal, event),
      },
      upgradeClient: (request, socket, head) =>
        signal.upgrade(request, socket, head),
      handleClient: (request, response) => {
        if (!signal.handleHttp(request, response)) {
          response.writeHead(404);
          response.end();
        }
      },
      onEvent: event,
    });
  } catch (error) {
    await signal.close();
    throw error;
  }
  gateway.http.headersTimeout = 10000;
  gateway.http.requestTimeout = 20000;
  let cleanup: Promise<void> | null = null,
    closing: Promise<void> | null = null;
  const cleanupTimer = setInterval(() => {
    if (cleanup || closing) return;
    cleanup = backend
      .collectGarbage()
      .then(
        (result) => event("VOXEL_CLEANUP_COMPLETED", result),
        () => event("VOXEL_CLEANUP_FAILED", {}),
      )
      .finally(() => (cleanup = null));
  }, 60000);
  cleanupTimer.unref();
  event("VOXEL_SERVICE_STARTED", { buildId: runtime.build.buildId });
  return {
    gateway,
    build: runtime.build,
    logger,
    close: () => {
      if (!closing) {
        clearInterval(cleanupTimer);
        closing = (async () => {
          try {
            try {
              await signal.close();
            } finally {
              await gateway.close();
            }
          } finally {
            await cleanup;
          }
        })();
      }
      return closing;
    },
  };
}
