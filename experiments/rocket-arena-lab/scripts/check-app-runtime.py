#!/usr/bin/env python3
"""Reproduce Docker runtime copies/install without requiring a Docker daemon."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import time
import urllib.request
import urllib.error

root = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='rocket-app-runtime-') as temporary:
    target = Path(temporary)
    for name in ('package.json', 'package-lock.json'):
        shutil.copy2(root / name, target / name)
    for workspace in ('server', 'client', 'shared', 'simulation'):
        (target / workspace).mkdir()
        shutil.copy2(root / workspace / 'package.json', target / workspace / 'package.json')
        shutil.copytree(root / workspace / 'dist', target / workspace / 'dist')
    subprocess.run(['npm', 'ci', '--omit=dev', '--ignore-scripts'], cwd=target, check=True,
                   stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    env = {**os.environ, 'NODE_ENV': 'production', 'ROCKET_MODE': 'app', 'HOST': '127.0.0.1',
           'PORT': '19009', 'SUPABASE_URL': 'http://127.0.0.1:19007',
           'SUPABASE_SERVICE_ROLE_KEY': 'fixture-service-key',
           'ROCKET_TICKET_SECRET': 'fixture-secret-more-than-32-characters',
           'APP_ORIGINS': 'http://127.0.0.1:19008'}
    log = target / 'startup.log'
    with log.open('w') as output:
        process = subprocess.Popen(['node', 'server/dist/index.js'], cwd=target, env=env,
                                   stdout=output, stderr=subprocess.STDOUT)
        try:
            for _ in range(100):
                if process.poll() is not None:
                    raise RuntimeError(log.read_text())
                try:
                    with urllib.request.urlopen('http://127.0.0.1:19009/ready', timeout=1) as response:
                        assert json.load(response)['ok']
                    break
                except (urllib.error.URLError, TimeoutError):
                    time.sleep(.1)
            else:
                raise RuntimeError('Runtime readiness timeout')
            with urllib.request.urlopen('http://127.0.0.1:19009/') as response:
                assert 'text/html' in response.headers['Content-Type']
                assert 'frame-ancestors http://127.0.0.1:19008' in response.headers['Content-Security-Policy']
            try:
                urllib.request.urlopen('http://127.0.0.1:19009/matchmake/custom')
                raise AssertionError('Anonymous matchmaking was allowed')
            except urllib.error.HTTPError as error:
                assert error.code == 403
        finally:
            process.terminate()
            try:
                process.wait(timeout=12)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
                raise RuntimeError('Graceful runtime shutdown timed out')
    assert process.returncode == 0, log.read_text()
    lines = [json.loads(line) for line in log.read_text().splitlines() if line.startswith('{')]
    assert any(line.get('service') == 'rocket-server' and line.get('context', {}).get('event') == 'ROCKET_SERVICE_READY' for line in lines)
    report = {'status': 'PASS', 'productionInstall': True, 'compiledEntrypoint': True,
              'canonicalPlatformLogger': True, 'staticFramePolicy': True,
              'anonymousMatchmakingDenied': True, 'gracefulShutdown': True,
              'dockerImageBuilt': False}
    (root / '.run' / 'app-runtime-report.json').write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))
