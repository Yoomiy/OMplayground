export type ToVoiceSignal =
  | {
      type: "start";
      id: string;
      path: "/rtc" | "/rtc/v1";
      search: string;
      token: string;
      until: number;
      publish: boolean;
    }
  | { type: "input"; id: string; sequence: number; bytes: Uint8Array }
  | { type: "ack"; id: string; sequence: number }
  | { type: "renew"; id: string; until: number }
  | { type: "close"; id: string }
  | { type: "shutdown" };
export type FromVoiceSignal =
  | { type: "ready" }
  | { type: "frame"; id: string; sequence: number; bytes: Uint8Array }
  | { type: "input-ack"; id: string; sequence: number }
  | { type: "token-filtered"; id: string }
  | {
      type: "closed";
      id: string;
      reason: "EXPIRED" | "CLOSED" | "UPSTREAM" | "PROTOCOL" | "BACKPRESSURE";
      upstreamStatus?: number;
    };
