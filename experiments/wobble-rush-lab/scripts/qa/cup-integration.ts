import { COURSE_PACK_VERSION } from "../../src/shared/course-catalog"
import {
  type ClientMessage,
  decodeServerMessage,
  encodeClientMessage,
  type ServerMessage,
} from "../../src/shared/protocol"

const base = Bun.argv[2] ?? "http://127.0.0.1:19003"
const courseId = Bun.argv[3] ?? "cloudline-fork"
const wsBase = base.replace(/^http/, "ws")
function check(value: unknown, label: string): asserts value {
  if (!value) throw new Error(label)
  console.log(`ok ${label}`)
}
async function connect(code: string) {
  const socket = new WebSocket(`${wsBase}/ws/${code}`)
  const inbox: ServerMessage[] = []
  socket.addEventListener("message", (event) => inbox.push(decodeServerMessage(String(event.data))))
  await new Promise<void>((resolve, reject) => {
    socket.addEventListener("open", () => resolve(), { once: true })
    socket.addEventListener("error", () => reject(new Error("socket failed")), { once: true })
  })
  return {
    socket,
    inbox,
    send(message: ClientMessage) {
      socket.send(encodeClientMessage(message))
    },
    async wait(predicate: (message: ServerMessage) => boolean) {
      const deadline = Date.now() + 15_000
      while (Date.now() < deadline) {
        const message = inbox.find(predicate)
        if (message !== undefined) return message
        await Bun.sleep(25)
      }
      throw new Error(`message timed out: ${JSON.stringify(inbox)}`)
    },
  }
}
const response = await fetch(`${base}/api/rooms`, { method: "POST" })
const payload: unknown = await response.json()
check(
  typeof payload === "object" &&
    payload !== null &&
    "code" in payload &&
    typeof payload.code === "string",
  "room created",
)
const clients = await Promise.all([connect(payload.code), connect(payload.code)])
const [host, guest] = clients
check(host && guest, "two sockets opened")
try {
  const welcome = await host.wait((m) => m.type === "welcome")
  check(welcome.type === "welcome", "host identified")
  host.send({
    type: "join",
    name: "CupHost",
    mode: "party",
    colorIndex: 0,
    contentVersion: COURSE_PACK_VERSION,
  })
  await host.wait((m) => m.type === "roster" && m.snapshot.players.length === 1)
  guest.send({
    type: "join",
    name: "CupGuest",
    mode: "party",
    colorIndex: 1,
    contentVersion: COURSE_PACK_VERSION,
  })
  await host.wait((m) => m.type === "roster" && m.snapshot.players.length === 2)
  host.send({ type: "configure", courseId, mode: "cup", remix: true })
  const configured = await host.wait(
    (m) => m.type === "roster" && m.snapshot.session?.mode === "cup",
  )
  check(configured.type === "roster" && configured.snapshot.session, "shared cup configured")
  const playlist = configured.snapshot.session.playlist
  check(new Set(playlist).size === 3 && playlist[0] === courseId, "three distinct courses")
  for (let round = 0; round < 3; round++) {
    for (const client of clients) client.inbox.length = 0
    host.send({ type: "ready", ready: true })
    guest.send({ type: "ready", ready: true })
    const phases = await Promise.all(
      clients.map((client) => client.wait((m) => m.type === "phase" && m.phase === "racing")),
    )
    for (const phase of phases)
      check(
        phase.type === "phase" &&
          phase.session?.courseId === playlist[round] &&
          phase.session?.round === round,
        `round ${round + 1} shared course`,
      )
    host.send({ type: "state", p: [0, 1, 10], v: [0, 0, 8], yaw: 0, st: "run", cp: 1 })
    await guest.wait((m) => m.type === "states" && m.players.some((p) => p.p[2] === 10))
    host.send({ type: "finish", timeMs: 20_000 })
    guest.send({ type: "finish", timeMs: 22_000 })
    const resultFrames = await Promise.all(
      clients.map((client) => client.wait((m) => m.type === "results")),
    )
    check(
      JSON.stringify(resultFrames[0]) === JSON.stringify(resultFrames[1]),
      `round ${round + 1} identical results and cup standings`,
    )
    const result = resultFrames[0]
    check(
      result?.type === "results" &&
        result.session?.standings[0]?.points === (round + 1) * 10 &&
        result.session.standings[1]?.points === (round + 1) * 8,
      `round ${round + 1} cumulative points`,
    )
    check(result.session.complete === (round === 2), `round ${round + 1} completion flag`)
    host.send({ type: "restart" })
    const lobbies = await Promise.all(
      clients.map((client) =>
        client.wait(
          (m) =>
            m.type === "roster" &&
            m.snapshot.phase === "lobby" &&
            m.snapshot.players.every((p) => !p.ready && p.state === null),
        ),
      ),
    )
    check(lobbies.length === 2, `round ${round + 1} both return to ready lobby`)
  }
  console.log(`CUP_PROTOCOL_PASS ${JSON.stringify({ base, playlist })}`)
} finally {
  for (const client of clients) client.socket.close()
}
