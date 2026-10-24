#!/usr/bin/env python3
"""Exercise the root dev command on an isolated port, without a real database."""
import json
import os
from pathlib import Path
import re
import subprocess
import time
import urllib.error
import urllib.request

game = Path(__file__).resolve().parents[1]
repo = game.parents[1]
endpoint = 'http://127.0.0.1:19010'
env = {**os.environ, 'ROCKET_PORT': '19010', 'SUPABASE_URL': 'http://127.0.0.1:19007',
       'SUPABASE_SECRET_KEY': 'fixture-service-key', 'APP_ORIGINS': 'http://localhost:5173'}
log = game / '.run/app-dev-command.log'
log.parent.mkdir(exist_ok=True)
with log.open('w') as output:
    process = subprocess.Popen(['node', 'scripts/dev-rocket.mjs'], cwd=repo, env=env,
                               stdout=output, stderr=subprocess.STDOUT)
    try:
        for _ in range(1200):
            if process.poll() is not None:
                raise RuntimeError(log.read_text())
            try:
                with urllib.request.urlopen(endpoint + '/ready', timeout=1) as response:
                    ready = json.load(response)
                    assert ready['ok']
                    assert ready['release'].startswith('app-')
                break
            except (urllib.error.URLError, TimeoutError):
                time.sleep(.1)
        else:
            raise RuntimeError('Dev command readiness timeout')
        with urllib.request.urlopen(endpoint + '/api/rocket/config') as response:
            config = json.load(response)
            assert config['release'] == ready['release']
            assert 'lobby-controls' in config['capabilities']
        try:
            urllib.request.urlopen(urllib.request.Request(endpoint + '/api/rocket/launch',
                data=b'{}', method='POST', headers={'Origin': 'http://localhost:5173', 'Content-Type': 'application/json'}))
            raise AssertionError('Anonymous launch succeeded')
        except urllib.error.HTTPError as error:
            assert error.code == 401
        for _ in range(50):
            if 'UNAUTHORIZED' in log.read_text():
                break
            time.sleep(.1)
    finally:
        process.terminate()
        try:
            process.wait(timeout=20)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
            raise RuntimeError('Dev runner did not stop its child')
assert process.returncode == 0, log.read_text()
plain = re.sub(r'\x1b\[[0-9;]*m', '', log.read_text())
assert 'ROCKET_SERVICE_READY' in plain and 'environment: "development"' in plain
assert 'ROCKET_REQUEST_FAILED UNAUTHORIZED' in plain
assert not any(line.startswith('{"level":') for line in plain.splitlines())
try:
    urllib.request.urlopen(endpoint + '/ready', timeout=1)
    raise AssertionError('Dev service survived runner shutdown')
except urllib.error.URLError:
    pass
report = {'status': 'PASS', 'rootDevCommand': True, 'prettyLogging': True,
          'failureCodeVisible': True, 'loadedReleaseVisible': True, 'gracefulShutdown': True,
          'productionDatabaseUsed': False}
(game / '.run/app-dev-logging-report.json').write_text(json.dumps(report, indent=2))
print(json.dumps(report, indent=2))
