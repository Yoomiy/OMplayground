import {
  SignalRequest,
  SignalResponse,
  LeaveRequest,
  LeaveRequest_Action,
  TrackSource,
  TrackType,
} from "@livekit/protocol";
import {
  JoinRequest,
  WrappedJoinRequest,
  WrappedJoinRequest_Compression,
} from "@livekit/protocol";
import { gunzipSync, gzipSync } from "node:zlib";
export const MAX_SIGNAL_BYTES = 512 * 1024;
const requests = new Set([
  "offer",
  "answer",
  "trickle",
  "addTrack",
  "mute",
  "subscription",
  "trackSetting",
  "leave",
  "subscriptionPermission",
  "syncState",
  "ping",
  "pingReq",
  "updateAudioTrack",
]);
const responses = new Set([
  "join",
  "answer",
  "offer",
  "trickle",
  "update",
  "trackPublished",
  "leave",
  "mute",
  "speakersChanged",
  "roomUpdate",
  "connectionQuality",
  "streamStateUpdate",
  "subscribedQualityUpdate",
  "subscriptionPermissionUpdate",
  "trackUnpublished",
  "pong",
  "reconnect",
  "pongResp",
  "subscriptionResponse",
  "requestResponse",
  "trackSubscribed",
  "mediaSectionsRequirement",
  "subscribedAudioCodecUpdate",
]);
/** Accept SDK connection settings, never browser-selected identity or metadata. */
export function providerSearch(search: string, publish: boolean): string {
  if (search.length > 16384) throw new Error("SIGNAL_QUERY_SIZE");
  const input = new URLSearchParams(search),
    output = new URLSearchParams();
  const names = [
    "sdk",
    "version",
    "protocol",
    "client_protocol",
    "device_model",
    "os",
    "os_version",
    "browser",
    "browser_version",
    "auto_subscribe",
    "adaptive_stream",
    "network",
  ];
  for (const name of names) {
    if (input.getAll(name).length > 1) throw new Error("SIGNAL_QUERY");
    const value = input.get(name);
    if (value !== null) output.set(name, value);
  }
  if (input.has("join_request")) {
    if (input.getAll("join_request").length !== 1)
      throw new Error("SIGNAL_QUERY");
    const encoded = input.get("join_request")!;
    if (!/^[A-Za-z0-9_=-]+$/.test(encoded)) throw new Error("SIGNAL_JOIN");
    const wrapped = WrappedJoinRequest.fromBinary(
      Buffer.from(encoded, "base64url"),
      { readUnknownFields: false },
    );
    const raw =
      wrapped.compression === WrappedJoinRequest_Compression.GZIP
        ? gunzipSync(wrapped.joinRequest, { maxOutputLength: MAX_SIGNAL_BYTES })
        : wrapped.compression === WrappedJoinRequest_Compression.NONE
          ? wrapped.joinRequest
          : null;
    if (!raw || raw.byteLength > MAX_SIGNAL_BYTES)
      throw new Error("SIGNAL_JOIN");
    const join = JoinRequest.fromBinary(raw, { readUnknownFields: false });
    join.metadata = "";
    join.participantAttributes = {};
    join.reconnect = false;
    join.participantSid = "";
    join.syncState = undefined;
    join.reconnectReason = 0;
    if (
      join.addTrackRequests.some(
        (t) =>
          !publish ||
          t.type !== TrackType.AUDIO ||
          t.source !== TrackSource.MICROPHONE,
      )
    )
      throw new Error("SIGNAL_PUBLISH");
    const clean = new WrappedJoinRequest({
      compression: WrappedJoinRequest_Compression.GZIP,
      joinRequest: gzipSync(join.toBinary({ writeUnknownFields: false })),
    });
    output.set(
      "join_request",
      // LiveKit's join query uses padded URL-safe base64. Go's decoder rejects
      // unpadded variants for two of the three possible encoded lengths.
      Buffer.from(clean.toBinary())
        .toString("base64")
        .replaceAll("+", "-")
        .replaceAll("/", "_"),
    );
  }
  return output.toString();
}
/** Never pass a reusable SFU credential or provider-directed migration to a browser. */
export function browserSignal(bytes: Uint8Array): Uint8Array | null {
  if (bytes.byteLength > MAX_SIGNAL_BYTES) throw new Error("SIGNAL_SIZE");
  const message = SignalResponse.fromBinary(bytes, {
    readUnknownFields: false,
  });
  if (message.message.case === "refreshToken") return null;
  if (!message.message.case || !responses.has(message.message.case))
    throw new Error("SIGNAL_RESPONSE");
  if (message.message.case === "leave") {
    message.message.value.canReconnect = false;
    message.message.value.action = LeaveRequest_Action.DISCONNECT;
    message.message.value.regions = undefined;
  }
  // Re-encode without unknown fields, including nested fields: a future provider
  // field must not accidentally forward a new credential-bearing extension.
  return message.toBinary({ writeUnknownFields: false });
}
export function providerSignal(
  bytes: Uint8Array,
  publish: boolean,
): Uint8Array {
  if (bytes.byteLength > MAX_SIGNAL_BYTES) throw new Error("SIGNAL_SIZE");
  const message = SignalRequest.fromBinary(bytes, { readUnknownFields: false });
  if (!message.message.case || !requests.has(message.message.case))
    throw new Error("SIGNAL_REQUEST");
  if (
    message.message.case === "addTrack" &&
    (!publish ||
      message.message.value.type !== TrackType.AUDIO ||
      message.message.value.source !== TrackSource.MICROPHONE)
  )
    throw new Error("SIGNAL_PUBLISH");
  return message.toBinary({ writeUnknownFields: false });
}
export function leaveSignal(): Uint8Array {
  return new SignalRequest({
    message: {
      case: "leave",
      value: new LeaveRequest({
        canReconnect: false,
        action: LeaveRequest_Action.DISCONNECT,
      }),
    },
  }).toBinary();
}
export function terminalSignal(): Uint8Array {
  return new SignalResponse({
    message: {
      case: "leave",
      value: new LeaveRequest({
        canReconnect: false,
        action: LeaveRequest_Action.DISCONNECT,
      }),
    },
  }).toBinary();
}
