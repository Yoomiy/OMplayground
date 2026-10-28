import type { SupabaseClient } from "@supabase/supabase-js";
import { AccessToken, TrackSource } from "livekit-server-sdk";
import { randomUUID } from "node:crypto";
import type {
  GatewayApiContext,
  GatewayOptions,
} from "../../../games/voxel/src/server/gateway.ts";
import {
  readMediaAuthorization,
  readMediaReceipt,
  readMediaState,
} from "../../../games/voxel/src/shared/media.ts";
import type {
  MediaAction,
  VoiceTicket,
} from "../../../games/voxel/src/shared/media.ts";
import { SchoolAccess, AccessDenied, bearerToken } from "./school-access.ts";
import type { Subject } from "./school-access.ts";
import { PersistenceError } from "./supabase-persistence.ts";
import { VoiceSignaling } from "./voice-signaling.ts";
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
type ActorProof = NonNullable<ReturnType<GatewayApiContext["actor"]>>;
export class SupabaseMedia {
  private client: SupabaseClient;
  constructor(client: SupabaseClient) {
    this.client = client;
  }
  private async rpc(name: string, args: Record<string, unknown>) {
    try {
      const result = await this.client.rpc(name, args).retry(false);
      if (result.error) throw new PersistenceError(name, result.error);
      return result.data;
    } catch (error) {
      throw error instanceof PersistenceError
        ? error
        : new PersistenceError(name, error);
    }
  }
  async verifyInstallation() {
    const v = await this.rpc("voxel_media_status", {});
    if (
      !v ||
      typeof v !== "object" ||
      Array.isArray(v) ||
      Object.keys(v).length !== 2 ||
      v.schema !== 1 ||
      v.revisionFencing !== true
    )
      throw new PersistenceError("media_installation_protocol");
  }
  async authorize(
    room: string,
    actor: string,
    proof: ActorProof,
    mediaRevision: number | null,
    until: number,
  ) {
    const value = readMediaAuthorization(
      await this.rpc("voxel_media_authorize", {
        p_session: room,
        p_world: proof.worldId,
        p_owner: proof.owner,
        p_epoch: proof.epoch,
        p_actor: actor,
        p_revision: proof.admissionRevision,
        p_participation: proof.role,
        p_media_revision: mediaRevision,
        p_authorized_until: new Date(until).toISOString(),
      }),
    );
    if (!value || value.hidden !== (proof.role === "observer"))
      throw new PersistenceError("media_authorization_protocol");
    return value;
  }
  async moderate(
    room: string,
    actor: string,
    id: string,
    target: string | null,
    action: MediaAction,
    until: number,
  ) {
    const value = await this.rpc("voxel_media_moderate", {
      p_session: room,
      p_actor: actor,
      p_request: id,
      p_target: target,
      p_action: action,
      p_authorized_until: new Date(until).toISOString(),
    });
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      Object.keys(value).length !== 8
    )
      throw new PersistenceError("media_receipt_protocol");
    const receipt = readMediaReceipt({
      ...value,
      saved: false,
      revocationRequested: value.current && value.revision > 0,
    });
    if (
      !receipt ||
      receipt.requestId !== id ||
      receipt.target !== target ||
      receipt.action !== action
    )
      throw new PersistenceError("media_receipt_protocol");
    return receipt;
  }
  async state(room: string, actor: string, until: number) {
    const value = readMediaState(
      await this.rpc("voxel_media_state", {
        p_session: room,
        p_actor: actor,
        p_authorized_until: new Date(until).toISOString(),
      }),
    );
    if (!value) throw new PersistenceError("media_state_protocol");
    return value;
  }
}
export function voiceConfig(env: Readonly<Record<string, string | undefined>>) {
  const endpoint = env.LIVEKIT_URL,
    key = env.LIVEKIT_API_KEY,
    secret = env.LIVEKIT_API_SECRET;
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
/** Binds opaque signaling admission to one current gameplay connection. */
export class SchoolVoice {
  private access: SchoolAccess;
  private media: SupabaseMedia;
  private signal: VoiceSignaling;
  private credentials: ReturnType<typeof voiceConfig>;
  constructor(
    access: SchoolAccess,
    media: SupabaseMedia,
    signal: VoiceSignaling,
    credentials: ReturnType<typeof voiceConfig>,
  ) {
    this.access = access;
    this.media = media;
    this.signal = signal;
    this.credentials = credentials;
  }
  private same(
    expected: ActorProof,
    current: ActorProof | null,
  ): current is ActorProof {
    return (
      !!current &&
      expected.connection === current.connection &&
      expected.role === current.role &&
      expected.worldId === current.worldId &&
      expected.owner === current.owner &&
      expected.epoch === current.epoch &&
      expected.admissionRevision === current.admissionRevision
    );
  }
  private async proof(
    room: string,
    token: string,
    subject: Subject,
    original: ActorProof,
    context: GatewayApiContext,
    mediaRevision: number | null,
  ) {
    const started = Date.now(),
      before = context.actor(room, subject.id);
    if (!this.same(original, before)) throw new AccessDenied("NOT_IN_ROOM");
    const fresh = await this.access.authorize(token, {
        room,
        participation: original.role === "observer" ? "observer" : "player",
      }),
      after = context.actor(room, subject.id);
    if (
      fresh.subject.id !== subject.id ||
      fresh.subject.role !== subject.role ||
      fresh.actor.role !== original.role ||
      !this.same(original, after)
    )
      throw new AccessDenied("NOT_IN_ROOM");
    const until = Math.floor(
      Math.min(
        started + 5000,
        before.expiresAt,
        after.expiresAt,
        fresh.expiresAt,
      ),
    );
    if (Date.now() >= until) throw new AccessDenied("VOICE_EXPIRED");
    const policy = await this.media.authorize(
        room,
        subject.id,
        original,
        mediaRevision,
        until,
      ),
      current = context.actor(room, subject.id);
    if (
      !this.same(original, current) ||
      Date.now() >= until ||
      Date.now() >= current.expiresAt
    )
      throw new AccessDenied("NOT_IN_ROOM");
    return {
      policy,
      expiresAt: Math.floor(Math.min(until, current.expiresAt)),
    };
  }
  async issue(
    room: string,
    token: string,
    context: GatewayApiContext,
  ): Promise<VoiceTicket> {
    const identity = await this.access.identity(token),
      original = context.actor(room, identity.subject.id);
    if (!original) throw new AccessDenied("NOT_IN_ROOM");
    const initial = await this.proof(
        room,
        token,
        identity.subject,
        original,
        context,
        null,
      ),
      bindingId = randomUUID(),
      credential = new AccessToken(
        this.credentials.key,
        this.credentials.secret,
        {
          identity: identity.subject.id + ":" + bindingId,
          ttl: "2m",
          metadata: JSON.stringify({ actorId: identity.subject.id, bindingId }),
        },
      );
    credential.addGrant({
      roomJoin: true,
      room: `voxel-v13-${original.worldId}-${original.epoch}`,
      canPublish: initial.policy.publish,
      canPublishSources: initial.policy.publish ? [TrackSource.MICROPHONE] : [],
      canSubscribe: true,
      canPublishData: false,
      canUpdateOwnMetadata: false,
      hidden: initial.policy.hidden,
    });
    const privateToken = await credential.toJwt();
    // The SQL snapshot may finish before a racing mute. The relay's cutoff
    // barrier also checks issue and consumption, after asynchronous policy IO.
    const ticket = this.signal.issue({
      scope: room + ":" + identity.subject.id,
      token: privateToken,
      publish: initial.policy.publish,
      expiresAt: initial.expiresAt,
      ...(identity.subject.role === "kid"
        ? {
            policy: {
              room,
              actor: identity.subject.id,
              revision: initial.policy.revision,
            },
          }
        : {}),
      revalidate: async () => {
        try {
          const current = await this.proof(
            room,
            token,
            identity.subject,
            original,
            context,
            initial.policy.revision,
          );
          if (
            current.policy.publish !== initial.policy.publish ||
            current.policy.hidden !== initial.policy.hidden
          )
            return null;
          return { expiresAt: current.expiresAt };
        } catch {
          return null;
        }
      },
    });
    return Object.freeze({
      ...ticket,
      publish: initial.policy.publish,
      hidden: initial.policy.hidden,
      actorId: identity.subject.id,
      bindingId,
    });
  }
}
/** Policy persistence and requested transport revocation are separate receipts. */
export function schoolMediaApi(
  access: SchoolAccess,
  media: SupabaseMedia,
  voice: SchoolVoice,
  signal: VoiceSignaling,
  event: (
    name: string,
    context: Record<string, string | number | boolean>,
  ) => void,
): NonNullable<GatewayOptions["api"]> {
  const run =
    (
      operation: "ticket" | "state" | "moderate",
    ): NonNullable<GatewayOptions["api"]>[string] =>
    async (req, body, res, context) => {
      let id = "invalid";
      try {
        if (!body || typeof body !== "object" || Array.isArray(body))
          throw new AccessDenied("INVALID");
        const v = body as Record<string, unknown>;
        if (
          typeof v.room !== "string" ||
          !UUID.test(v.room) ||
          Object.keys(v).length !== (operation === "moderate" ? 4 : 1)
        )
          throw new AccessDenied("INVALID");
        if (operation === "moderate") {
          if (
            typeof v.requestId !== "string" ||
            !UUID.test(v.requestId) ||
            !["mute", "unmute"].includes(v.action as string) ||
            !(
              v.target === null ||
              (typeof v.target === "string" && UUID.test(v.target))
            )
          )
            throw new AccessDenied("INVALID");
          id = v.requestId;
        }
        const token = bearerToken(req.headers.authorization);
        if (!token) throw new AccessDenied("UNAUTHORIZED");
        if (operation === "ticket") {
          if (!context) throw new AccessDenied("NOT_IN_ROOM");
          return await voice.issue(v.room, token, context);
        }
        const started = Date.now(),
          identity = await access.identity(token),
          until = Math.min(started + 5000, identity.expiresAt);
        if (identity.subject.role === "kid")
          throw new AccessDenied("FORBIDDEN");
        if (Date.now() >= until) throw new AccessDenied("VOICE_EXPIRED");
        if (operation === "state")
          return await media.state(v.room, identity.subject.id, until);
        const receipt = await media.moderate(
          v.room,
          identity.subject.id,
          id,
          v.target as string | null,
          v.action as MediaAction,
          until,
        );
        if (receipt.revocationRequested)
          signal.revoke(v.room, receipt.target, receipt.revision);
        event("VOXEL_MEDIA_POLICY_APPLIED", {
          correlationId: id,
          room: v.room,
          action: receipt.action,
          current: receipt.current,
          revision: receipt.revision,
        });
        return receipt;
      } catch (error) {
        const code =
          error instanceof AccessDenied
            ? error.code
            : error instanceof PersistenceError &&
                error.providerCode === "42501"
              ? "FORBIDDEN"
              : error instanceof PersistenceError &&
                  error.providerCode === "22023"
                ? "CONFLICT"
                : error instanceof PersistenceError &&
                    error.providerCode === "55000"
                  ? "SESSION_ENDED"
                  : "MEDIA_UNCONFIRMED";
        event("VOXEL_MEDIA_REJECTED", { correlationId: id, operation, code });
        res.writeHead(
          code === "INVALID"
            ? 400
            : code === "UNAUTHORIZED"
              ? 401
              : code === "CONFLICT" || code === "SESSION_ENDED"
                ? 409
                : code === "MEDIA_UNCONFIRMED"
                  ? 503
                  : 403,
          { "Content-Type": "application/json", "Cache-Control": "no-store" },
        );
        res.end(JSON.stringify({ error: code, saved: false }));
        return null;
      }
    };
  return {
    "/api/voxel/voice-ticket": run("ticket"),
    "/api/voxel/media-state": run("state"),
    "/api/voxel/media-moderate": run("moderate"),
  };
}
