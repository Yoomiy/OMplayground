# Asset provenance

- Game foundation: [code-yeongyu/wobble-rush-3d](https://github.com/code-yeongyu/wobble-rush-3d), revision `b395e4a91ebdfb829533b1ae6beda244371658a3`, MIT. Retain the copyright notice in `LICENSE`; the built client serves a copy.
- Courses, obstacles and character visuals are procedural Three.js geometry, with Playground adaptations recorded in the source. Audio is synthesized in `src/client/audio.ts`; no recorded music or sound pack is bundled.
- Catalog art: `apps/web/public/games/wobble-rush.png`, generated for Playground with OpenAI image generation. The illustration depicts colorful racers and an obstacle-course diorama; it is a catalog asset rather than a gameplay screenshot.
- The embedded page requests the Baloo 2 font from Google Fonts. The font is not bundled in this source tree; CSS includes fallback fonts.
- Third-party runtime code is declared and pinned in `package.json` and `package-lock.json`.
