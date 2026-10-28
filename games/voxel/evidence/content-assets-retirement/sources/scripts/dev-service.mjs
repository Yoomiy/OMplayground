import { fileURLToPath } from 'node:url';
import { services } from './dev-service-plan.mjs';

const kind = process.argv[2], service = services[kind];
if (!service) throw new Error('Use board, voxel or classroom');
if (process.versions.node !== '24.21.0') throw new Error('Use Node 24.21.0 for app development');
process.chdir(fileURLToPath(new URL('../apps/' + service.app + '/', import.meta.url)));
process.env.NODE_ENV = 'development';
// Local services have distinct ports even when a shared credential file has PORT.
process.env.PORT = String(service.port);
process.env.HOST = '127.0.0.1';
process.env.VOXEL_HOST = '127.0.0.1';
const localOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
for (const name of ['CORS_ORIGIN', 'VOXEL_ALLOWED_ORIGINS']) {
  const configured = (process.env[name] ?? '').split(',').map(value => value.trim()).filter(Boolean);
  process.env[name] = [...new Set([...configured, ...localOrigins])].join(',');
}
const required = ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', ...(kind === 'board' ? [] : ['LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET'])];
const missing = required.filter(name => !process.env[name]?.trim());
if (missing.length) throw new Error(`Missing ${missing.join(', ')}. Set them in apps/${service.app}/.env; existing local credential files are also loaded.`);
if (!process.env.SUPABASE_SECRET_KEY.startsWith('sb_secret_')) throw new Error('SUPABASE_SECRET_KEY must be the new server-only secret key');
if (process.argv.includes('--check')) {
  console.log(`Development configuration present: ${service.app} on ${service.port}; no provider requests made.`);
} else {
  await import(new URL('../apps/' + service.app + '/src/index.ts', import.meta.url));
}
