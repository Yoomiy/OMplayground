import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { supervise } from './dev-app.mjs';

test('a failed dev process gracefully stops its own peer and waits for cleanup', { skip: process.platform === 'win32' }, async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'playground-dev-supervisor-'));
  const ready = path.join(directory, 'ready'), closed = path.join(directory, 'closed');
  try {
    const peer = `const fs=require('fs');fs.writeFileSync(${JSON.stringify(ready)},String(process.pid));process.on('SIGTERM',()=>setTimeout(()=>{fs.writeFileSync(${JSON.stringify(closed)},'drained');process.exit(0)},20));setInterval(()=>{},100);`;
    const failed = `const fs=require('fs');const end=Date.now()+5000;function check(){if(fs.existsSync(${JSON.stringify(ready)}))process.exit(7);if(Date.now()>end)process.exit(9);setTimeout(check,10)}check();`;
    const code = await supervise([
      { command: process.execPath, args: ['-e', peer] },
      { command: process.execPath, args: ['-e', failed] },
    ], { signals: false, graceMs: 2000 });
    assert.equal(code, 7);
    assert.equal(readFileSync(closed, 'utf8'), 'drained');
    const pid = Number(readFileSync(ready, 'utf8'));
    assert.throws(() => process.kill(pid, 0), error => error.code === 'ESRCH');
  } finally {
    assert(existsSync(directory));
    rmSync(directory, { recursive: true });
  }
});

test('the actual watch/tsx flags support typed workers and graceful shutdown', { skip: process.platform === 'win32', timeout: 10000 }, async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'playground-dev-watch-'));
  const ready = path.join(directory, 'ready'), closed = path.join(directory, 'closed');
  try {
    writeFileSync(path.join(directory, 'package.json'), '{"type":"module"}');
    writeFileSync(path.join(directory, 'worker.ts'), "import {parentPort} from 'node:worker_threads';const value:string='ready';parentPort!.postMessage(value);setInterval(()=>{},100);");
    writeFileSync(path.join(directory, 'main.mjs'), `import {Worker} from 'node:worker_threads';import fs from 'node:fs';const worker=new Worker(new URL('worker.ts',import.meta.url));worker.once('message',()=>fs.writeFileSync(${JSON.stringify(ready)},String(process.pid)));process.once('SIGTERM',async()=>{await new Promise(resolve=>setTimeout(resolve,50));await worker.terminate();fs.writeFileSync(${JSON.stringify(closed)},'drained');process.exit(0)});`);
    const failed = `const fs=require('fs');const end=Date.now()+5000;function check(){if(fs.existsSync(${JSON.stringify(ready)}))process.exit(7);if(Date.now()>end)process.exit(9);setTimeout(check,10)}check();`;
    const code = await supervise([
      { command: process.execPath, args: ['--import=tsx', '--watch', '--watch-kill-signal=SIGTERM', path.join(directory, 'main.mjs')] },
      { command: process.execPath, args: ['-e', failed] },
    ], { signals: false, graceMs: 2000 });
    assert.equal(code, 7);
    assert.equal(readFileSync(closed, 'utf8'), 'drained');
    const pid = Number(readFileSync(ready, 'utf8'));
    assert.throws(() => process.kill(pid, 0), error => error.code === 'ESRCH');
  } finally {
    rmSync(directory, { recursive: true });
  }
});
