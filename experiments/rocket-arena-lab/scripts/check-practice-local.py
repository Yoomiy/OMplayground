#!/usr/bin/env python3
"""After npm run build, check practice UI and loss recovery on isolated loopback ports.

Optional browser tooling comes from PLAYWRIGHT_MODULE and its Chromium environment.
Does not start, stop or change the public services. Only its own children are stopped.
"""
import json
import os
from pathlib import Path
import shutil
import signal
import socket
import subprocess
import time
import urllib.request

root = Path(__file__).resolve().parents[1]
node = os.environ.get('NODE_BINARY') or shutil.which('node')
for port in (19004, 19005):
    with socket.socket() as check:
        check.bind(('127.0.0.1', port))
children, logs = [], []


def launch(args, cwd, env, name):
    log = (root / '.run' / name).open('w')
    logs.append(log)
    process = subprocess.Popen(args, cwd=cwd, env=env, stdout=log, stderr=subprocess.STDOUT,
                               start_new_session=True)
    children.append(process)
    return process


def ready(url):
    for _ in range(100):
        try:
            with urllib.request.urlopen(url, timeout=.5) as response:
                if response.status == 200:
                    return
        except Exception:
            pass
        time.sleep(.2)
    raise RuntimeError('Readiness timeout ' + url)


def process_sample(process):
    stat = Path(f'/proc/{process.pid}/stat').read_text().split()
    rss = next(line.split()[1] for line in Path(f'/proc/{process.pid}/status').read_text().splitlines()
               if line.startswith('VmRSS:'))
    return dict(cpuSeconds=(int(stat[13]) + int(stat[14])) / os.sysconf('SC_CLK_TCK'), rssMiB=int(rss) / 1024)


env = {**os.environ, 'NODE_ENV': 'production', 'ROCKET_ARENA_DEV_CONTROLS': 'false',
       'HOST': '127.0.0.1', 'PORT': '19004', 'LAB_SERVER_PORT': '19004'}
qaenv = {**env, 'LAB_BROWSER_URL': 'http://127.0.0.1:19005' + os.environ.get('LAB_BROWSER_QUERY', '')}
try:
    server = launch([node, 'dist/index.js'], root / 'server', env, 'practice-server.log')
    ready('http://127.0.0.1:19004/matchmake/custom')
    bots = launch([node, 'scripts/lab-bots.mjs'], root,
                  {**env, 'LAB_BOT_ENDPOINT': 'ws://127.0.0.1:19004'}, 'practice-bots.log')
    launch([node, str(root / 'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1',
            '--port', '19005'], root / 'client', env, 'practice-preview.log')
    ready('http://127.0.0.1:19005')
    print('Isolated built preview and loopback bots ready', flush=True)
    began = time.monotonic()
    before = {name: process_sample(process) for name, process in [('server', server), ('bots', bots)]}
    subprocess.run([node, 'scripts/check-bot-practice.mjs'], cwd=root, env=qaenv, timeout=240, check=True)
    duration = time.monotonic() - began
    usage = {}
    for name, process in [('server', server), ('bots', bots)]:
        after = process_sample(process)
        usage[name] = dict(cpuPercentOfOneCore=100 * (after['cpuSeconds'] - before[name]['cpuSeconds']) / duration,
                           rssMiB=after['rssMiB'])
    (root / '.run/practice-processes.json').write_text(json.dumps(dict(seconds=duration,
        conditions='Whole functional browser test, includes lobby/loading/cleanup. Shared VPS, not a steady-state benchmark.',
        processes=usage), indent=2) + '\n')
    print('Running delayed/lost-input trace check', flush=True)
    with (root / '.run/practice-network.log').open('w') as output:
        subprocess.run([node, 'node_modules/tsx/dist/cli.mjs', '--conditions=development', 'scripts/playtest-smoke.mts'],
                       cwd=root, env={**env, 'LAB_TEST_ENDPOINT': 'ws://127.0.0.1:19004', 'LAB_TEST_WORKER': '1'},
                       stdout=output, stderr=subprocess.STDOUT, timeout=90, check=True)
    print('Network/trace check PASS', flush=True)
finally:
    for process in reversed(children):
        if process.poll() is None:
            os.killpg(process.pid, signal.SIGTERM)
    for process in children:
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
    for log in logs:
        log.close()
