import * as Y from "yjs";
import {
  applyClassroomDrawingUpdate,
  applyClassroomDrawingSocketUpdate,
  canApplyClassroomDrawingSocketUpdate,
  canvasFromDoc,
  clearClassroomDrawingState,
  createClassroomDrawingState,
  encodeFullClassroomDrawingState,
  snapshotClassroomDrawingState
} from "./classroomDrawingState";

function decode(update: string) {
  return new Uint8Array(Buffer.from(update, "base64"));
}

describe("classroom drawing live state", () => {
  it("hydrates from a checkpoint and serves the canonical document to a late joiner", () => {
    const server = createClassroomDrawingState({
      status: "playing",
      seats: { host: "p1" },
      canvas: {
        engine: "excalidraw",
        version: 4,
        clearVersion: 0,
        updatedAt: 1,
        elements: [{ id: "persisted", type: "rectangle" }],
        files: {}
      }
    });
    const lateJoiner = new Y.Doc();

    Y.applyUpdate(lateJoiner, decode(encodeFullClassroomDrawingState(server)));

    expect(canvasFromDoc(lateJoiner).elements).toEqual([
      { id: "persisted", type: "rectangle" }
    ]);
  });

  it("accepts a client delta into the server document and rejects over-limit state", () => {
    const server = createClassroomDrawingState(undefined);
    const client = new Y.Doc();
    Y.applyUpdate(client, decode(encodeFullClassroomDrawingState(server)));
    const elements = client.getArray<Y.Map<unknown>>("elements");
    const element = new Y.Map<unknown>();
    element.set("el", { id: "live", type: "ellipse" });
    element.set("pos", "a0");
    elements.push([element]);

    const update = Y.encodeStateAsUpdate(client, Y.encodeStateVector(server.doc));
    expect(applyClassroomDrawingUpdate(server, Buffer.from(update).toString("base64"))).toEqual({ ok: true });
    expect(canvasFromDoc(server.doc).elements).toEqual([{ id: "live", type: "ellipse" }]);
  });

  it("clears the canonical document and advances its durable revision", () => {
    const state = createClassroomDrawingState({
      status: "playing",
      seats: { host: "p1" },
      canvas: {
        engine: "excalidraw",
        version: 2,
        clearVersion: 1,
        updatedAt: 1,
        elements: [{ id: "old", type: "line" }],
        files: {}
      }
    });

    clearClassroomDrawingState(state);

    expect(snapshotClassroomDrawingState(state, { host: "p1" }).canvas).toMatchObject({
      version: 3,
      clearVersion: 2,
      elements: []
    });
  });

  it("hydrates checkpoint elements with valid appendable ordering keys", () => {
    const state = createClassroomDrawingState({
      status: "playing",
      seats: { host: "p1" },
      canvas: {
        engine: "excalidraw",
        version: 1,
        clearVersion: 0,
        updatedAt: 1,
        elements: Array.from({ length: 63 }, (_, index) => ({ id: `el-${index}`, type: "line" })),
        files: {}
      }
    });
    const elements = state.doc.getArray<Y.Map<unknown>>("elements");

    expect(elements.get(0).get("pos")).toBe("a0");
    expect(elements.get(61).get("pos")).toBe("az");
    expect(elements.get(62).get("pos")).toBe("b00");
  });

  it("does not consider a socket writable until it acknowledges its canonical sync", () => {
    const server = createClassroomDrawingState({
      status: "playing",
      seats: { host: "p1" },
      canvas: {
        engine: "excalidraw",
        version: 1,
        clearVersion: 0,
        updatedAt: 1,
        elements: [{ id: "canonical", type: "rectangle" }],
        files: {}
      }
    });
    const joiningClient = new Y.Doc();
    Y.applyUpdate(joiningClient, decode(encodeFullClassroomDrawingState(server)));
    joiningClient.getArray<Y.Map<unknown>>("elements").delete(0, 1);
    const destructiveUpdate = Buffer.from(
      Y.encodeStateAsUpdate(joiningClient, Y.encodeStateVector(server.doc))
    ).toString("base64");
    const sync = {
      sessionId: "classroom-session",
      token: "sync-token",
      acknowledged: false
    };

    expect(canApplyClassroomDrawingSocketUpdate(sync, "classroom-session")).toBe(false);
    expect(
      applyClassroomDrawingSocketUpdate(server, sync, "classroom-session", destructiveUpdate)
    ).toEqual({ ok: false, code: "SYNC_NOT_ACKNOWLEDGED" });
    expect(canvasFromDoc(server.doc).elements).toEqual([{ id: "canonical", type: "rectangle" }]);

    sync.acknowledged = true;
    expect(canApplyClassroomDrawingSocketUpdate(sync, "classroom-session")).toBe(true);
    expect(canApplyClassroomDrawingSocketUpdate(sync, "another-session")).toBe(false);
    expect(
      applyClassroomDrawingSocketUpdate(server, sync, "classroom-session", destructiveUpdate)
    ).toEqual({ ok: true });
    expect(canvasFromDoc(server.doc).elements).toEqual([]);
  });
});
