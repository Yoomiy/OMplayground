import type { ActionClientMessage } from "../shared/action-protocol"
import type { PlatformControl } from "../shared/platform-protocol"
import { isWobbleView, type WobbleView } from "../shared/platform-view"
import { NetClient } from "./net"
import { dispatchSessionMessage, type SessionEvents, type SessionTransport } from "./session-link"

/** Reuses native action transport/prediction. Every reconnect gets fresh app authorization. */
export class AppSessionLink implements SessionTransport {
  private client: NetClient | null = null
  private generation = 0
  private admitted = false
  constructor(
    private readonly events: SessionEvents,
    private readonly sessionId: string,
    private readonly callbacks: {
      view(view: WobbleView): void
      error(code: string): void
      disconnected(): void
    },
  ) {}
  get active(): boolean {
    return this.client !== null && this.admitted
  }
  send(message: ActionClientMessage): void {
    if (this.admitted) this.client?.send(message)
  }
  control(control: PlatformControl): void {
    this.client?.sendPlatform({ type: "control", control })
  }
  close(): void {
    this.generation++
    this.client?.close()
    this.client = null
    this.admitted = false
  }
  async connect(ticket: string): Promise<void> {
    this.close()
    const generation = this.generation
    const client = new NetClient(
      {
        onMessage: (message) => {
          if (generation !== this.generation) return
          if (message.type === "error") {
            this.callbacks.error(message.code)
            return
          }
          dispatchSessionMessage(this.events, message)
        },
        onClose: (_reason, code) => {
          if (generation !== this.generation) return
          this.client = null
          if (code === 4001) this.callbacks.error("REPLACEMENT_TAB")
          else if (code === 1008) this.callbacks.error("CONNECTION_FAILED")
          else if (code !== 4002) {
            this.events.onConnection(true)
            this.callbacks.disconnected()
          }
        },
      },
      () => performance.now(),
      {
        path: `/app-ws/${this.sessionId}`,
        receive: (value) => {
          if (
            !value ||
            typeof value !== "object" ||
            !("type" in value) ||
            value.type !== "platform" ||
            !("view" in value)
          )
            return false
          const view = value.view as WobbleView
          if (!isWobbleView(view, this.sessionId)) throw new Error("Invalid platform view")
          this.callbacks.view(view)
          if (view.ended) {
            this.close()
            return true
          }
          if (!this.admitted) {
            this.admitted = true
            this.events.onConnection(false)
            this.control({ action: "loaded" })
          }
          return true
        },
      },
    )
    this.client = client
    await client.connect("APP")
    if (generation === this.generation) client.sendPlatform({ type: "attach", ticket })
  }
}
