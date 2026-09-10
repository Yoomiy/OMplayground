export interface PresentationRoomState {
  presenterIdentity: string | null;
  presenterEpoch: number;
  visible: boolean;
  title: string | null;
  mediaKind: "document" | "image" | "video" | "audio" | null;
}

export type PresenterAssignmentDelivery = "persist-only" | "synchronize-room";

interface PresenterAssignmentEffects {
  persist: (state: PresentationRoomState) => Promise<void>;
  synchronizePermissions: (
    previous: PresentationRoomState,
    next: PresentationRoomState
  ) => Promise<void>;
  createCapability: (state: PresentationRoomState) => string | null;
  broadcast: (state: PresentationRoomState) => Promise<void>;
  sendCapability: (
    identity: string,
    capability: string,
    state: PresentationRoomState
  ) => Promise<void>;
}

export async function commitPresenterAssignment(
  previous: PresentationRoomState,
  identity: string | null,
  keepVisibility: boolean,
  delivery: PresenterAssignmentDelivery,
  effects: PresenterAssignmentEffects
): Promise<PresentationRoomState> {
  const next: PresentationRoomState = {
    ...previous,
    presenterIdentity: identity,
    presenterEpoch: previous.presenterEpoch + 1,
    visible: identity ? keepVisibility && previous.visible : false,
    title: identity ? previous.title : null,
    mediaKind: identity ? previous.mediaKind : null
  };

  await effects.persist(next);
  if (delivery === "persist-only") return next;

  await effects.synchronizePermissions(previous, next);
  const capability = effects.createCapability(next);
  await effects.broadcast(next);
  if (identity && capability) {
    await effects.sendCapability(identity, capability, next);
  }
  return next;
}
