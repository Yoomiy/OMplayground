#!/usr/bin/env node

/**
 * inject-bridge.mjs — Injects the Playground postMessage bridge into an
 * HTML5/WebAssembly game's index.html.
 *
 * Usage:
 *   node .agents/skills/playground-import-wasm-game/scripts/inject-bridge.mjs \
 *     apps/web/public/legacy/<gameKey>/index.html \
 *     <gameKey>
 *
 * What it does:
 *   1. Reads the target index.html.
 *   2. Injects a <script> block just before </body> (or at EOF if no </body>).
 *   3. The injected script:
 *      - Posts a "solo-ready" event to the parent so the React wrapper knows
 *        the iframe has loaded and can send restore-state.
 *      - Exposes window.__playgroundBridge with checkpoint() and finish()
 *        functions that the game code can call.
 *      - Listens for "restore-snapshot" messages from the parent to restore
 *        game state on resume.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const [, , htmlPath, gameKey] = process.argv;

if (!htmlPath || !gameKey) {
  console.error("Usage: inject-bridge.mjs <path/to/index.html> <gameKey>");
  process.exit(1);
}

const absPath = resolve(htmlPath);
let html = readFileSync(absPath, "utf-8");

// Check if bridge is already injected
if (html.includes("__playgroundBridge")) {
  console.log(`⚠ Bridge already present in ${absPath} — skipping.`);
  process.exit(0);
}

const bridgeScript = `
<!-- Playground postMessage Bridge (auto-injected) -->
<script>
(function () {
  "use strict";

  var GAME_KEY = ${JSON.stringify(gameKey)};
  var ORIGIN = window.location.origin;

  // --- Outbound: game → parent ---

  function postToParent(type, state) {
    if (!window.parent || window.parent === window) return;
    window.parent.postMessage(
      { source: "playground-legacy-game", gameKey: GAME_KEY, type: type, state: state || {} },
      ORIGIN
    );
  }

  /** Notify parent that the game is ready to receive restore-state. */
  function signalReady() {
    postToParent("solo-ready");
  }

  /**
   * Save a mid-game checkpoint (e.g. current level).
   * @param {{ currentLevel?: number, [key: string]: unknown }} state
   */
  function checkpoint(state) {
    postToParent("checkpoint", state);
  }

  /**
   * Report a finished game / score.
   * @param {{ score?: number, isComplete?: boolean, [key: string]: unknown }} state
   */
  function finish(state) {
    postToParent("finish", state);
  }

  // Expose globally so game code (C via EM_ASM, Godot via JavaScriptBridge,
  // Rust via wasm-bindgen, or plain JS) can call these.
  window.__playgroundBridge = {
    checkpoint: checkpoint,
    finish: finish,
    postToParent: postToParent,
  };

  // --- Inbound: parent → game ---

  window.addEventListener("message", function (event) {
    if (event.origin !== ORIGIN) return;
    var data = event.data;
    if (!data || data.source !== "playground-board" || data.gameKey !== GAME_KEY) return;

    if (data.type === "restore-snapshot" && data.snapshot) {
      // Make the snapshot available for game code to read.
      window.__playgroundBridge.restoredState = data.snapshot;
      // Dispatch a custom event so game code can listen for it.
      window.dispatchEvent(
        new CustomEvent("playground-restore", { detail: data.snapshot })
      );
    }
  });

  // Signal ready once the page has loaded.
  if (document.readyState === "complete") {
    signalReady();
  } else {
    window.addEventListener("load", signalReady);
  }
})();
</script>
`;

// Inject before </body> if present, otherwise append to end.
if (html.includes("</body>")) {
  html = html.replace("</body>", bridgeScript + "\n</body>");
} else {
  html += "\n" + bridgeScript;
}

writeFileSync(absPath, html, "utf-8");
console.log(`✓ Bridge injected into ${absPath} for gameKey="${gameKey}"`);
