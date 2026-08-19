import type { DrawingCanvasSnapshot } from "@playground/game-logic";

export interface DrawingViewport {
  scrollX: number;
  scrollY: number;
  zoom: unknown;
}

export type DrawingViewportRole = "publish" | "follow" | "independent";

export interface CanonicalDrawingDelta {
  yjsUpdate?: string;
  yjsAwareness?: string;
  yjsAwarenessClientIds?: number[];
  yjsAwarenessRemove?: number[];
  viewport?: DrawingViewport;
}

export interface CanonicalDrawingInbound {
  delta?: CanonicalDrawingDelta;
  yjsUpdate?: string;
  yjsAwareness?: string;
  yjsAwarenessRemove?: number[];
  viewport?: DrawingViewport;
}

export interface CanonicalDrawingMode {
  kind: "canonical";
  initialSync: { update: string; token: string } | null;
  initialViewport?: DrawingViewport | null;
  viewportRole: DrawingViewportRole;
  canClear: boolean;
  sendDelta: (payload: CanonicalDrawingDelta) => void;
  acknowledgeSync: (token: string) => void;
  subscribe: (cb: (payload: CanonicalDrawingInbound) => void) => () => void;
  clear: () => Promise<boolean>;
}

export interface LocalDrawingMode {
  kind: "local";
  persistSnapshot: (snapshot: DrawingCanvasSnapshot) => void | Promise<void>;
}

export type DrawingMode = CanonicalDrawingMode | LocalDrawingMode;
