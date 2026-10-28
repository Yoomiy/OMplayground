import assert from "node:assert/strict";
import { test } from "node:test";
import { gzipSync, gunzipSync } from "node:zlib";
import {
  SignalRequest,
  SignalResponse,
  JoinResponse,
  JoinRequest,
  WrappedJoinRequest,
  WrappedJoinRequest_Compression,
  TrackSource,
  TrackType,
} from "@livekit/protocol";
import {
  browserSignal,
  providerSignal,
  providerSearch,
  MAX_SIGNAL_BYTES,
} from "../src/voice-signal-protocol.ts";
test("media signaling withholds refreshed/migrated SFU credentials and strips unknown nested extensions", () => {
  const secret = "private-fixture-sfu-credential";
  assert.equal(
    browserSignal(
      new SignalResponse({
        message: { case: "refreshToken", value: secret },
      }).toBinary(),
    ),
    null,
  );
  assert.throws(
    () =>
      browserSignal(
        new SignalResponse({
          message: { case: "roomMoved", value: { token: secret } },
        }).toBinary(),
      ),
    /SIGNAL_RESPONSE/,
  );
  const hidden = Buffer.concat([
      Buffer.from([0xfa, 0x07, secret.length]),
      Buffer.from(secret),
    ]),
    join = new JoinResponse({ serverVersion: "fixture" }).toBinary(),
    nested = Buffer.concat([join, hidden]),
    packet = Buffer.concat([
      Buffer.from([0x0a, nested.length]),
      nested,
      hidden,
    ]);
  const clean = browserSignal(packet)!;
  assert(!Buffer.from(clean).includes(Buffer.from(secret)));
  assert.equal(SignalResponse.fromBinary(clean).message.case, "join");
  assert.throws(
    () => browserSignal(new Uint8Array(MAX_SIGNAL_BYTES + 1)),
    /SIGNAL_SIZE/,
  );
});
test("media signaling rejects forged publication sources and metadata mutation while preserving audio requests", () => {
  const audio = new SignalRequest({
    message: {
      case: "addTrack",
      value: {
        cid: "audio-fixture",
        type: TrackType.AUDIO,
        source: TrackSource.MICROPHONE,
      },
    },
  });
  assert.equal(
    SignalRequest.fromBinary(providerSignal(audio.toBinary(), true)).message
      .case,
    "addTrack",
  );
  assert.throws(
    () => providerSignal(audio.toBinary(), false),
    /SIGNAL_PUBLISH/,
  );
  const camera = new SignalRequest({
    message: {
      case: "addTrack",
      value: {
        cid: "camera-fixture",
        type: TrackType.VIDEO,
        source: TrackSource.CAMERA,
      },
    },
  });
  assert.throws(
    () => providerSignal(camera.toBinary(), true),
    /SIGNAL_PUBLISH/,
  );
  assert.throws(
    () =>
      providerSignal(
        new SignalRequest({
          message: {
            case: "updateMetadata",
            value: { metadata: "forged actor" },
          },
        }).toBinary(),
        true,
      ),
    /SIGNAL_REQUEST/,
  );
});
test("compressed media joins cannot override server identity metadata, resume old bindings or bypass source grants", () => {
  const join = new JoinRequest({
    metadata: "forged actor",
    participantAttributes: { role: "admin" },
    reconnect: true,
    participantSid: "old-participant",
    connectionSettings: { autoSubscribe: false },
  });
  for (const compression of [
    WrappedJoinRequest_Compression.NONE,
    WrappedJoinRequest_Compression.GZIP,
  ]) {
    const wrapper = new WrappedJoinRequest({
      compression,
      joinRequest:
        compression === WrappedJoinRequest_Compression.GZIP
          ? gzipSync(join.toBinary())
          : join.toBinary(),
    });
    const query = new URLSearchParams({
      join_request: Buffer.from(wrapper.toBinary()).toString("base64url"),
      access_token: "must-not-forward",
      use_json: "true",
      reconnect: "1",
      metadata: "forged",
    });
    const clean = new URLSearchParams(providerSearch(query.toString(), false));
    assert(
      !clean.has("access_token") &&
        !clean.has("use_json") &&
        !clean.has("reconnect") &&
        !clean.has("metadata"),
    );
    const wrapped = WrappedJoinRequest.fromBinary(
      Buffer.from(clean.get("join_request")!, "base64url"),
    );
    const decoded = JoinRequest.fromBinary(gunzipSync(wrapped.joinRequest));
    assert.equal(decoded.metadata, "");
    assert.deepEqual(decoded.participantAttributes, {});
    assert.equal(decoded.reconnect, false);
    assert.equal(decoded.participantSid, "");
    assert.equal(decoded.connectionSettings?.autoSubscribe, false);
    assert.equal(clean.get("join_request")!.length % 4, 0);
  }
  const bomb = new WrappedJoinRequest({
    compression: WrappedJoinRequest_Compression.GZIP,
    joinRequest: gzipSync(Buffer.alloc(MAX_SIGNAL_BYTES + 1, 65)),
  });
  assert.throws(() =>
    providerSearch(
      new URLSearchParams({
        join_request: Buffer.from(bomb.toBinary()).toString("base64url"),
      }).toString(),
      false,
    ),
  );
});
test("rewritten join queries retain SDK padding for every compressed length", () => {
  const residues = new Set<number>();
  for (let size = 0; size < 40; size++) {
    const join = new JoinRequest({ clientInfo: { version: "x".repeat(size) } }),
      wrapped = new WrappedJoinRequest({
        joinRequest: join.toBinary(),
        compression: WrappedJoinRequest_Compression.NONE,
      }),
      clean = new URLSearchParams(
        providerSearch(
          new URLSearchParams({
            join_request: Buffer.from(wrapped.toBinary()).toString("base64url"),
          }).toString(),
          true,
        ),
      ),
      encoded = clean.get("join_request")!,
      raw = Buffer.from(encoded, "base64url");
    residues.add(raw.byteLength % 3);
    assert.equal(encoded.length % 4, 0);
    assert.equal(
      encoded,
      raw.toString("base64").replaceAll("+", "-").replaceAll("/", "_"),
    );
  }
  assert.equal(residues.size, 3);
});
