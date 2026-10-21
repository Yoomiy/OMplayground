import { describe, expect, test } from "bun:test"
import { type ActionClientMessage, decodeActionClientMessage } from "../src/shared/action-protocol"
import type { ServerMessage } from "../src/shared/protocol"
import {
  decodeServerMessage,
  encodeServerMessage,
  PROTOCOL_VERSION,
  ProtocolError,
} from "../src/shared/protocol"
import type { RaceResult, RoomSnapshot } from "../src/shared/room"
import { asPlayerId, asRoomCode } from "../src/shared/types"

const SEED = 123_456_789

const snapshot: RoomSnapshot = {
  code: asRoomCode("WXYZ"),
  phase: "racing",
  seed: SEED,
  phaseEndsAtMs: null,
  players: [
    {
      id: asPlayerId("p-1"),
      name: "WobbleKing",
      colorIndex: 3,
      ready: true,
      finishedMs: null,
      lastSeenMs: 1000,
      state: null,
    },
    {
      id: asPlayerId("p-2"),
      name: "SecondPlace",
      colorIndex: 1,
      ready: false,
      finishedMs: 61_234,
      lastSeenMs: 2000,
      state: null,
    },
  ],
}

const results: readonly RaceResult[] = [
  { id: asPlayerId("p-2"), name: "SecondPlace", timeMs: 61_234, place: 1 },
  { id: asPlayerId("p-1"), name: "WobbleKing", timeMs: null, place: 2 },
]

const clientMessages: readonly ActionClientMessage[] = [
  { type: "ping", nonce: 42 },
  {
    type: "input",
    raceId: "race-1",
    seq: 1,
    tick: 1,
    respawn: false,
    input: {
      forward: 1,
      strafe: 0,
      jumpHeld: true,
      jumpPressed: true,
      divePressed: false,
      cameraYaw: 0,
    },
  },
]

const serverMessages: readonly ServerMessage[] = [
  { type: "welcome", you: asPlayerId("p-1"), room: asRoomCode("WXYZ"), seed: SEED, snapshot },
  { type: "roster", snapshot },
  { type: "phase", phase: "countdown", serverNowMs: 5000, phaseEndsAtMs: 8000, seed: SEED },
  { type: "phase", phase: "racing", serverNowMs: 8000, phaseEndsAtMs: null, seed: SEED },
  { type: "results", results },
  { type: "error", code: "room_full", message: "Room is full (8 players)" },
]

function expectProtocolError(fn: () => unknown): ProtocolError {
  try {
    fn()
  } catch (e) {
    if (e instanceof ProtocolError) return e
    throw e
  }
  throw new Error("expected a ProtocolError to be thrown")
}

describe("protocol version", () => {
  test("is pinned to 1", () => {
    expect(PROTOCOL_VERSION).toBe(1)
  })
})

describe("authoritative client messages", () => {
  for (const message of clientMessages) {
    test(`${message.type} round-trips`, () => {
      expect(decodeActionClientMessage(JSON.stringify(message))).toEqual(message)
    })
  }
  for (const type of [
    "join",
    "resume",
    "state",
    "finish",
    "ready",
    "configure",
    "restart",
    "leave",
  ]) {
    test(`rejects the removed ${type} wire command`, () => {
      expect(() => decodeActionClientMessage(JSON.stringify({ type }))).toThrow()
    })
  }
  test("rejects non-finite and out-of-range inputs", () => {
    const message = clientMessages[1]
    if (message?.type !== "input") throw new Error("missing input fixture")
    for (const forward of [2, -2, Infinity, NaN]) {
      expect(() =>
        decodeActionClientMessage(
          JSON.stringify({ ...message, input: { ...message.input, forward } }),
        ),
      ).toThrow()
    }
  })
  test("rejects malformed JSON and oversized commands", () => {
    expect(() => decodeActionClientMessage("{broken")).toThrow()
    expect(() => decodeActionClientMessage(" ".repeat(4097))).toThrow(ProtocolError)
  })
})

describe("server message round-trips", () => {
  for (const message of serverMessages) {
    test(`${message.type} survives encode → decode unchanged`, () => {
      expect(decodeServerMessage(encodeServerMessage(message))).toEqual(message)
    })
  }

  test("decodes from an ArrayBuffer", () => {
    const message = serverMessages[5]
    if (message === undefined) throw new Error("fixture missing")
    const bytes = new TextEncoder().encode(encodeServerMessage(message))
    expect(decodeServerMessage(bytes.buffer)).toEqual(message)
  })
})

describe("server decode rejects garbage", () => {
  test("malformed JSON throws ProtocolError with issues", () => {
    const err = expectProtocolError(() => decodeServerMessage("[1,2"))
    expect(err.issues.length).toBeGreaterThan(0)
  })

  test("unknown type throws ProtocolError with issues", () => {
    const err = expectProtocolError(() => decodeServerMessage('{"type":"hack"}'))
    expect(err.issues.length).toBeGreaterThan(0)
  })

  test("missing nested field throws ProtocolError with issues", () => {
    const err = expectProtocolError(() => decodeServerMessage('{"type":"roster","snapshot":{}}'))
    expect(err.issues.length).toBeGreaterThan(0)
  })

  test("rejects removed pose relay payloads throws ProtocolError", () => {
    const raw =
      '{"type":"states","serverNowMs":1,"players":[{"id":"p-1","p":[0,0,0],"v":[0,0,0],"yaw":1e999,"st":"run","cp":0}]}'
    const err = expectProtocolError(() => decodeServerMessage(raw))
    expect(err.issues.length).toBeGreaterThan(0)
  })
})
