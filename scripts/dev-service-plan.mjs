import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const repo = fileURLToPath(new URL('../', import.meta.url));
export const services = {
  board: { port: 8080, app: 'game-server', files: ['apps/game-server/.env'] },
  voxel: { port: 3001, app: 'voxel-server', files: ['apps/minecraft-server/.env', 'apps/voxel-server/.env'] },
  classroom: { port: 8083, app: 'classroom-server', files: ['apps/minecraft-server/.env', 'apps/voxel-server/.env', 'apps/classroom-server/.env'] },
};
export function serviceArguments(kind, { check = false } = {}) {
  const service = services[kind];
  if (!service) throw new Error('Unknown development service');
  return [
    ...service.files.map(file => new URL(file, new URL('../', import.meta.url))).filter(file => existsSync(file)).map(file => '--env-file=' + fileURLToPath(file)),
    '--import=tsx',
    ...(!check ? ['--watch', '--watch-kill-signal=SIGTERM'] : []),
    fileURLToPath(new URL('dev-service.mjs', import.meta.url)),
    kind,
    ...(check ? ['--check'] : []),
  ];
}
