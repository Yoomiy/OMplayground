import { readFile, writeFile } from 'node:fs/promises';
const source = process.argv[2] ?? new URL('../../../packages/game-logic/src/rematch.ts', import.meta.url);
const target = new URL('../server/src/platform/rematch-policy.ts', import.meta.url);
await writeFile(target, '// Generated from packages/game-logic/src/rematch.ts by scripts/sync-rematch.mjs.\n' + await readFile(source, 'utf8'));
