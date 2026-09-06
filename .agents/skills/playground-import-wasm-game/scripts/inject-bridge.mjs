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
 *      - Handles idempotent teardown, requests engine shutdown, releases the
 *        WebGL context, and acknowledges completion.
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
    var payload = { source: "playground-legacy-game", gameKey: GAME_KEY, type: type };
    if (state !== undefined) payload.state = state;
    window.parent.postMessage(
      payload,
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

  var teardownPromise;
  function teardown() {
    if (teardownPromise) return teardownPromise;
    teardownPromise = Promise.resolve().then(function () {
      if (typeof engine !== "undefined" && engine && typeof engine.requestQuit === "function") {
        return engine.requestQuit();
      }
    }).catch(function () {
      // The parent still blanks the iframe; continue with local WebGL cleanup.
    }).then(function () {
      var canvas = document.getElementById("canvas");
      if (!canvas || typeof canvas.getContext !== "function") return;
      var gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
      var loseContext = gl && gl.getExtension("WEBGL_lose_context");
      if (loseContext) loseContext.loseContext();
    });
    return teardownPromise;
  }

  // Expose globally so game code (C via EM_ASM, Godot via JavaScriptBridge,
  // Rust via wasm-bindgen, or plain JS) can call these.
  window.__playgroundBridge = {
    checkpoint: checkpoint,
    finish: finish,
    postToParent: postToParent,
    teardown: teardown,
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

    if (data.type === "teardown") {
      teardown().then(function () {
        postToParent("teardown-complete");
      });
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

const existingBridge = /<!-- Playground postMessage Bridge \(auto-injected\) -->\s*<script>[\s\S]*?<\/script>/;

// Refresh an existing generated bridge, otherwise inject a new one.
if (existingBridge.test(html)) {
  html = html.replace(existingBridge, bridgeScript.trim());
} else if (html.includes("</body>")) {
  html = html.replace("</body>", bridgeScript + "\n</body>");
} else {
  html += "\n" + bridgeScript;
}

writeFileSync(absPath, html, "utf-8");
console.log(`✓ Bridge updated in ${absPath} for gameKey="${gameKey}"`);
