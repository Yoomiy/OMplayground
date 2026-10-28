import { spawnSync } from 'node:child_process';
import { supervise } from './dev-app.mjs';
import { repo, serviceArguments } from './dev-service-plan.mjs';

const kind = process.argv[2];
const check = spawnSync(process.execPath, serviceArguments(kind, { check: true }), { cwd: repo, stdio: 'inherit' });
if (check.error || check.status !== 0) process.exitCode = 1;
else process.exitCode = await supervise([{ command: process.execPath, args: serviceArguments(kind) }]);
