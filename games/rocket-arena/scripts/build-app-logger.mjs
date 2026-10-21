import { readFile, writeFile, copyFile } from 'node:fs/promises';
import ts from 'typescript';

// Compile the canonical platform logger into the isolated service artifact.
// No maintained logger fork; the dedicated service artifact includes canonical platform utilities.
const source = process.argv[2] ?? new URL('../../../packages/observability/src/logger.ts', import.meta.url);
const code = await readFile(source, 'utf8');
const result = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.CommonJS, esModuleInterop: true } });
await writeFile(new URL('../server/dist/platform/shared-logger.cjs', import.meta.url), result.outputText);
const voiceSource = process.argv[3] ?? new URL('../../../apps/game-server/src/gameVoiceToken.ts', import.meta.url);
const voice = ts.transpileModule(await readFile(voiceSource, 'utf8'), { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true,
} });
await writeFile(new URL('../server/dist/platform/shared-voice.cjs', import.meta.url), voice.outputText);
await copyFile(new URL('../LICENSE', import.meta.url), new URL('../client/dist/LICENSE', import.meta.url));
