import type { ContentManifest } from '../shared/content.ts';
export type JobIdentity = {
  worldId: string;
  contentHash: string;
  generatorVersion: number;
  x: number;
  z: number;
  incarnation: number;
  subscription: number;
  revision: number;
  version: number;
};
export type EngineJob =
  | { id: number; tag: JobIdentity; kind: 'generate' }
  | { id: number; tag: JobIdentity; kind: 'mesh'; region: Uint8Array };
export type EngineResult =
  | { id: number; tag: JobIdentity; kind: 'generate'; data: Uint8Array }
  | { id: number; tag: JobIdentity; kind: 'mesh'; data: Uint32Array };
export type EngineConfig = { module: WebAssembly.Module; content: ContentManifest; seed: number };
export function sameJob(a: JobIdentity, b: JobIdentity): boolean {
  return (
    a.worldId === b.worldId &&
    a.contentHash === b.contentHash &&
    a.generatorVersion === b.generatorVersion &&
    a.x === b.x &&
    a.z === b.z &&
    a.incarnation === b.incarnation &&
    a.subscription === b.subscription &&
    a.revision === b.revision &&
    a.version === b.version
  );
}
