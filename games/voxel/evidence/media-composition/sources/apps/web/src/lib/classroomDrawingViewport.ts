import type { DrawingViewportRole } from "@/games/drawing/drawingMode";

interface ClassroomDrawingViewportRoleInput {
  isHost: boolean;
  canUseWhiteboard: boolean;
  localIdentity: string | null | undefined;
  presenterIdentity: string | null;
}

export function classroomDrawingViewportRole({
  isHost,
  canUseWhiteboard,
  localIdentity,
  presenterIdentity
}: ClassroomDrawingViewportRoleInput): DrawingViewportRole {
  if (isHost && localIdentity && localIdentity === presenterIdentity) return "publish";
  return canUseWhiteboard ? "independent" : "follow";
}
