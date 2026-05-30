# Collaborative Drawing Board — Full Prototype

## Goal

Turn the current drawing activity into a **real-time collaborative whiteboard**:

- Rich drawing tools: pen, shapes, text, images, selection, undo/redo, eraser, colors, export.
- **Everyone draws at once.** No rounds, no turns, no drawer/guesser roles, no prompts, no scoring.
- **No host privilege** for drawing actions. Any participant can draw, clear, and export. `hostId` stays only for session lifecycle (disconnect/pause/resume), never for canvas permissions.
- Multiplayer: many editors on one shared canvas with low-traffic sync.
- Solo mode: a local Excalidraw sketchpad with autosave and export.
- Target audience is **PCs only**. No mobile layout work in the prototype.
- Room size up to **10 participants**.

This is not a rewrite of the playground/session architecture. We keep the existing room/socket server and swap the SVG stroke surface for an embedded open-source drawing engine, **plus** add one small generic relay path (see "Sync Model") that true collaboration requires.

## Current State

Relevant files:

- `apps/web/src/games/DrawingBoard.tsx`
  - React component with SVG polyline drawing, one stroke at a time.
  - Fixed palette/width, host-only Clear, emits `ADD_STROKE` only on pointer up.
- `packages/game-logic/src/drawing.ts`
  - Shared module. State is `drawings: DrawingStroke[]`. Host-only `CLEAR`. Stroke caps.
- `apps/web/src/games-solo/DrawingSolo.tsx`
  - Reuses `DrawingBoard` with local solo autosave.
- `apps/web/src/game/GameSessionContainer.tsx`
  - Maps the generic session snapshot into `DrawingBoard` (BOARD_REGISTRY entry `drawing`).
- `apps/game-server/src/room.ts` + `apps/game-server/src/index.ts`
  - Generic room state, `applyIntent`, and **full-state** `ROOM_SNAPSHOT` broadcast on every successful intent.

The stroke-array model cannot support selection, object editing, text, images, shape resizing, robust undo/redo, or document-level persistence. More importantly, the current broadcast model (full `room.state` to everyone on every intent) is the wrong shape for many simultaneous editors.

## Recommendation

Use **Excalidraw** (`@excalidraw/excalidraw`, MIT, official React package).

Why:

- Strong multi-element editor out of the box: freehand, shapes, text, images, selection, undo/redo, export.
- **Built-in element-level reconciliation primitives** that make true collaboration tractable (see below).
- Far less work than building a collaborative editor from scratch.

Avoid:

- Iframing a full drawing app.
- Forking a large app and preserving its own storage/routing/auth/collab stack.
- Expanding the SVG stroke board into a real editor by hand.

tldraw remains a fallback if Excalidraw's collab story feels limiting, but Excalidraw's element-version model is enough for this prototype.

## The Hard Part: Sync Model (traffic)

This is the centerpiece, since the board is now many-editors-at-once.

### Why the current path won't work

`apps/game-server/src/index.ts` rebroadcasts the **entire** `room.state` to every member on each successful intent:

```ts
io.to(`session:${room.sessionId}`).emit("ROOM_SNAPSHOT", roomSnapshot(room));
```

For a shared canvas that is `O(scene_size × edits/sec × players)`. With 10 editors and an image-bearing scene, that is untenable. We need element deltas and a relay, not full-scene snapshots.

### Design: element deltas + relay lane + durable checkpoint

Two transport lanes:

1. **Live lane (ephemeral, high-frequency, tiny).** Element deltas (and optionally cursors). The server **relays** them to other room members only (sender excluded) and does **not** mutate authoritative state, run `applyIntent`, or persist. This single change kills both the bandwidth problem and the echo-loop bug.
2. **Durable lane (low-frequency).** An authoritative scene checkpoint kept server-side in memory and folded from incoming deltas. Used for (a) late-joiner initial sync and (b) pause/persist to DB. Written to DB only at boundaries or on a coarse interval, never per edit.

### Traffic-reduction techniques (ranked)

1. **Element-level deltas, not full scenes.** Every Excalidraw element carries `id`, `version`, `versionNonce`, `updated`, `isDeleted`. On `onChange`, send only elements whose `version` increased (or new ids) plus newly-deleted ids. This is the single biggest win — typical edits become a handful of small objects.
2. **Relay instead of authoritative rebroadcast.** Hot deltas go through a new generic `LIVE_DELTA` socket event that the server forwards with `socket.to('session:'+id).emit(...)`. No `room.state` rewrite, no serialization of the whole scene, no DB write. Sender is excluded, so no echo.
3. **Coalesce + throttle.** Batch changed elements over ~75–150 ms windows and emit one message. Keep only the latest `version` per element id in the window. While a single freehand stroke is in progress the element mutates rapidly — send intermediate updates at ~10 Hz so peers see live progress, then the final on pointer-up.
4. **Reconcile on receive.** Use Excalidraw's reconciliation (keep higher `version`, tie-break by `versionNonce`) then `updateScene`. Conflict-free enough for a shared board; order-independent.
5. **Images are separate from geometry.** Excalidraw stores image bytes in `files: BinaryFiles` keyed by `fileId`; elements only reference the `fileId`. So:
   - Transmit each image's bytes **once** (a `FILE_ADD` message / included in the durable checkpoint), never inside per-move deltas. Moving/resizing an image afterwards sends only the small element transform.
   - **Downscale + recompress on insert** (see "Image Tool"): cap longest edge (~1280 px), re-encode to WebP/JPEG ~0.7 before the file enters the scene.
6. **Compression.** Enable socket.io `perMessageDeflate`; JSON deltas compress very well.
7. **Strip volatile appState.** When persisting/checkpointing, store only `elements` + `files`. Drop `scroll`, `zoom`, `selectedElementIds`, `collaborators`, etc. (Also prevents remote edits from hijacking each viewer's scroll/zoom.)
8. **Caps (bounded memory/DB).** Max elements (e.g. 5,000), max checkpoint bytes (e.g. 2 MB jsonb — fine now that it is not broadcast hot), max images, per-file byte cap. Reject/degrade past caps with a clear toast.

### Late join

On `JOIN_ROOM` the server already emits `ROOM_SNAPSHOT` carrying `gameState` (the checkpoint). The joiner loads that, then live deltas bring them current. Optional refinement: have one existing client answer a join with a full-scene rebroadcast to close any checkpoint-to-live gap. Checkpoint-on-join is enough for the prototype if checkpoints are frequent.

### Authority tradeoff (explicit)

The project rule prefers an authoritative server. A free-for-all canvas has no competitive integrity to protect, so we deliberately relax authority on the hot path: deltas are relayed as opaque payloads with only light validation (sender is seated, payload size cap). The **durable checkpoint** remains the source of truth for persistence and late-join, and it is validated (seated, serializable, element/byte caps) before being stored. This keeps the spirit of the rule (bounded, validated persisted state) while making real-time collaboration feasible.

## Phase 1: Collaborative Surface

### Install

```bash
npm install @excalidraw/excalidraw -w @playground/web
```

Lazy-load the editor (`React.lazy` / dynamic import) so Excalidraw's large chunk stays out of the main bundle.

### Component shape

Keep the outer contract simple and stable so `GameSessionContainer` barely changes:

```ts
export interface DrawingBoardProps {
  gameState: DrawingState;
  mySeat: string | null;
  onIntent: (intent: DrawingIntent) => void;
  /** Ephemeral relay lane for live deltas (does not persist). */
  onLiveDelta?: (payload: DrawingDelta) => void;
  /** Subscribe to peers' live deltas. Returns an unsubscribe fn. */
  subscribeLiveDeltas?: (cb: (payload: DrawingDelta) => void) => () => void;
}
```

Internal split:

- `apps/web/src/games/drawing/DrawingBoard.tsx` — game-facing shell (participant list, Clear, Export). Thin top bar only; no overlay over the canvas.
- `apps/web/src/games/drawing/DrawingCanvas.tsx` — Excalidraw wrapper: diff `onChange` → deltas; reconcile incoming deltas; manage `files`.
- `apps/web/src/games/drawing/drawingSync.ts` — delta diffing, coalescing/throttle, per-element version tracking, reconcile helper.
- `apps/web/src/games/drawing/drawingImages.ts` — image downscale/recompress + caps.
- `apps/web/src/games/DrawingBoard.tsx` — export shim: `export { DrawingBoard } from "./drawing/DrawingBoard";`

### State model

Replace `drawings: DrawingStroke[]` with a document checkpoint. No status machine, no players/scores/rounds.

```ts
export interface DrawingState {
  /** Never terminal; kept only to match the seats/status convention. */
  status: "playing";
  seats?: Record<string, string>;
  canvas: DrawingCanvasSnapshot;
}

export interface DrawingCanvasSnapshot {
  engine: "excalidraw";
  /** Monotonic checkpoint counter, server-incremented. */
  version: number;
  updatedAt: number;
  /** Excalidraw elements (validated, opaque element fields). */
  elements: unknown[];
  /** Excalidraw BinaryFiles map (image bytes), keyed by fileId. */
  files: Record<string, unknown>;
}
```

`seats` is kept only for presence/labels and the "seated" relay check. No seat has special drawing rights.

### Intents (durable lane) and deltas (live lane)

Durable, server-validated, persisted:

```ts
export type DrawingIntent =
  | { type: "CHECKPOINT"; version: number; elements: unknown[]; files: Record<string, unknown> }
  | { type: "CLEAR_CANVAS" };
```

Live, relayed only (never persisted, opaque payload):

```ts
export interface DrawingDelta {
  /** Changed/added elements (latest version per id). */
  changed: unknown[];
  /** Ids deleted this batch. */
  deleted: string[];
  /** New image files added this batch (sent once). */
  files?: Record<string, unknown>;
}
```

Rules:

- **Any seated participant** may draw, send `LIVE_DELTA`, send `CHECKPOINT`, and send `CLEAR_CANVAS`. No host gate.
- Server relays `LIVE_DELTA` to peers (sender excluded), no validation beyond seated + payload byte cap.
- Server validates `CHECKPOINT`/`CLEAR_CANVAS` (seated, serializable, element/byte/file caps, `version` strictly newer) before storing.
- `CLEAR_CANVAS` resets the checkpoint and is broadcast like any other op; clients confirm locally before sending (avoid accidental wipes).

### Server changes

This direction does require a small, generic addition to the socket layer (the prior plan's "no major changes" no longer holds for true collab).

`apps/game-server/src/index.ts` — add one ephemeral relay handler:

```ts
socket.on("LIVE_DELTA", (payload: { sessionId: string; delta: unknown }) => {
  const room = getRoom(payload?.sessionId);
  if (!room || !room.players.has(userId)) return;       // seated only
  if (byteLength(payload.delta) > LIVE_DELTA_MAX) return; // light cap
  socket.to(`session:${room.sessionId}`).emit("LIVE_DELTA", {
    from: userId,
    delta: payload.delta
  });
});
```

- Generic and game-agnostic (any future game could relay ephemeral data).
- Does not touch `room.state`, `applyIntent`, or persistence.
- Enable `perMessageDeflate` in the socket.io server options.

`packages/game-logic/src/drawing.ts` — `CHECKPOINT`/`CLEAR_CANVAS` validation:

- `version` is an integer strictly greater than `state.canvas.version`.
- `elements` is an array under the element cap; `files` under the file/byte caps.
- Whole payload is JSON-serializable and under the byte cap (e.g. 2 MB).
- Caller is seated (already enforced by `room.ts applyIntent`). No host check.

`apps/game-server/src/room.ts` — no structural change. The chess-specific block stays as-is. Drawing needs no clock/ticker (no timers in this direction).

### Image tool (kept, with degradation)

Keep images on. Bound their cost:

- Intercept image insert and **downscale** to a max longest edge (~1280 px) and **recompress** to WebP/JPEG quality ~0.7 via an offscreen canvas, then hand the re-encoded dataURL to Excalidraw as the file.
- Per-file byte cap (e.g. 512 KB after re-encode) and max images per board; reject past caps with a toast.
- Image bytes travel once in `FILE_ADD`/checkpoint, never in move deltas.
- Later option: upload to Supabase Storage and reference a URL instead of embedding base64 (cuts socket + DB weight). Out of scope for the prototype; client-side downscale + embed is enough.

### Undo/redo

Excalidraw owns local undo/redo. Undo/redo simply produces element changes, which flow through the normal delta path. The server does not model undo history.

### Solo mode

`apps/web/src/games-solo/DrawingSolo.tsx`:

- Full Excalidraw surface, no socket, local state only.
- Autosave `{ elements, files }` via `useSoloAutoSave`.
- Clear and Export (PNG/SVG via Excalidraw export APIs).
- No prompts/timer (this direction drops the game loop entirely).

### Backward compatibility

Existing solo saves are `{ drawings: DrawingStroke[] }`.

Options:
1. Ignore old saves for the prototype (show a one-time "previous drawings can't be opened" notice).
2. Convert old strokes → Excalidraw freehand elements (each stroke → one `freedraw` element with the sampled points).

Recommendation: ship option 1 first; add option 2 only if real saved drawings matter.

## Phase 2: Collaboration Polish

(No game loop. "Phase 2" here is robustness, not mechanics.)

- **Cursor presence (optional, high value):** broadcast pointer position on the live lane (tiny, frequent, never persisted, relayed only). Render labeled remote cursors. Cheap way to make the board feel real-time.
- **Conflict robustness:** verify reconciliation under concurrent edits to the same element; ensure deletes win or lose deterministically by version.
- **Late-join correctness:** confirm a joiner mid-session sees the full board (checkpoint) within one snapshot, then live edits.
- **Checkpoint cadence:** fold deltas into the in-memory authoritative scene; push a `CHECKPOINT` on a coarse interval (e.g. every few seconds while dirty) and on pause/idle, not per edit.
- **Reconnect:** on reconnect, reload the checkpoint and resume the delta stream.

## UI Prototype (PC only)

- **Top bar:** participant list/avatars, Clear (with confirm), Export, connection status. No host-only controls.
- **Main area:** full-height Excalidraw canvas with its native toolbar.
- No mobile layout, no bottom drawer/tabs.

## Client Changes

### `apps/web/src/games/DrawingBoard.tsx`
Replace SVG implementation; becomes the export shim to `drawing/DrawingBoard.tsx`.

### `apps/web/src/game/GameSessionContainer.tsx`
Wire the new live-lane props: pass an `onLiveDelta` that emits `LIVE_DELTA` over the existing socket, and a `subscribeLiveDeltas` that listens for inbound `LIVE_DELTA`. `gameState`/`onIntent` mapping stays as today. This is the only meaningful container change.

### `apps/web/src/games-solo/DrawingSolo.tsx`
Adapt initial state + autosave to `{ elements, files }`. No live lane (solo).

## Player count: 4 → 10

- **Module:** set `maxPlayers: 10` in `packages/game-logic/src/drawing.ts` (gates `ROOM_FULL` in `room.ts assignPlayer`).
- **DB migration (required, data-only — no schema change):** `games.max_players` is a plain integer with no CHECK constraint, and `game_sessions.player_ids uuid[]` has no length cap.

```sql
-- supabase/migrations/<timestamp>_drawing_max_players_10.sql
UPDATE public.games
  SET max_players = 10
  WHERE game_url = 'drawing';
```

- The web matchmaking/lobby reads `max_players` from the catalog row, so the UI reflects 10 automatically once the migration runs.
- **Action for you:** run this migration against Supabase (local `supabase db push` and the hosted project).

## Persistence

- Store the checkpoint (`{ elements, files }`, volatile appState stripped) in `game_sessions.game_state` (already `jsonb`).
- Because checkpoints are not broadcast hot, a larger cap (~2 MB) is acceptable, but still bounded by the element/image caps above.

## Milestones

### Milestone 1: Solo Excalidraw Sketchpad
- Excalidraw renders in the solo route, lazy-loaded.
- Autosave `{ elements, files }`; Clear and Export work.
- Image insert downscales/recompresses.
- Verify: `npm run lint -w @playground/web`; draw, refresh, scene returns.

### Milestone 2: Real-time Collaborative Sync
- `LIVE_DELTA` relay added to game server (seated-only, byte cap, sender excluded, deflate on).
- `DrawingCanvas` diffs `onChange` → deltas, coalesces/throttles, reconciles inbound.
- `CHECKPOINT`/`CLEAR_CANVAS` intents with caps/version guard; checkpoint-on-join late sync.
- Any participant can draw and clear (no host gate).
- Verify: `packages/game-logic/src/drawing.test.ts` (validation + version/caps), existing room tests still pass, manual 3-browser concurrent draw, late-join sees full board.

### Milestone 3: Images + Scale
- Image tool with downscale/recompress and per-file/board caps; `FILE_ADD` once, not per move.
- Caps enforced with clear toasts.
- Verify: insert several images across browsers, confirm bounded traffic and DB checkpoint size.

### Milestone 4: Robustness
- Optional cursor presence.
- Reconnect reload, checkpoint cadence tuning, conflict edge cases, 10-participant load check.
- Verify: web lint, game-logic tests, game-server tests, `git diff --check`.

## Risks

### Traffic under many editors
Mitigation: element deltas + relay lane + coalescing + image-bytes-once + deflate (see Sync Model). Full scenes never travel on the hot path.

### Snapshot/checkpoint size
Mitigation: element/image/byte caps; strip volatile appState; checkpoint only at intervals/boundaries.

### Concurrent-edit conflicts
Mitigation: Excalidraw element-version reconciliation (higher version wins, tie-break `versionNonce`); order-independent merges. No CRDT/OT needed for a casual shared board.

### Echo loops / viewport hijack
Mitigation: relay excludes sender; reconcile by version (equal version = no-op); store/send only `elements` + `files`, never `scroll`/`zoom`/`collaborators`.

### Bundle size
Mitigation: lazy-load the editor chunk. (PC-only relaxes this, but still do it.)

### Server authority relaxation
Mitigation: hot path validated lightly (seated + byte cap); durable checkpoint fully validated and bounded; documented as an intentional tradeoff for a non-competitive shared canvas.

### Migration from old strokes
Mitigation: defer; ignore old saves with a notice, or convert strokes → freehand elements later.

## Resolved Direction (was Open Questions)

- **Collaborative free-draw only.** No turn-based mode, no rounds, no scoring.
- **No host privilege** for canvas actions. `hostId` only for session lifecycle.
- **PC only.** No mobile layout in the prototype.
- **Up to 10 participants** (one data-only migration + module constant).
- **Image tool kept**, with client-side downscale/recompress and caps.

Still worth deciding later:
- Prompt/practice helpers in solo (likely unneeded now).
- Whether to move images to Supabase Storage instead of embedding base64.
- Optional cursor presence in v1 vs later.

## Suggested First Implementation Pass

1. Add Excalidraw (lazy-loaded).
2. Build `DrawingCanvas` + `drawingSync.ts` for **solo** first (no socket).
3. Switch solo save to `{ elements, files }`; add Clear/Export; add `drawingImages.ts` downscaling.
4. Add the new `DrawingState.canvas` checkpoint shape + `CHECKPOINT`/`CLEAR_CANVAS` with caps/version guard; rewrite `drawing.test.ts`.
5. Add the generic `LIVE_DELTA` relay to the game server (seated-only, byte cap, deflate).
6. Wire `onLiveDelta`/`subscribeLiveDeltas` in `GameSessionContainer`; reconcile inbound deltas in `DrawingCanvas`.
7. Bump `maxPlayers` to 10 + ship the data migration.
8. Add image-once transport + caps, then optional cursor presence.

This delivers a genuine multi-user whiteboard while reusing the existing app shell and adding only one small, generic server capability.
