#!/usr/bin/env python3
"""Local source-layout migration, without starting services or accessing a DB."""
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile

repo = Path(__file__).resolve().parents[3]
with tempfile.TemporaryDirectory(prefix='rocket-local-migration-') as temporary:
    root = Path(temporary)
    (root / 'scripts').mkdir()
    shutil.copy2(repo / 'scripts/dev-rocket.mjs', root / 'scripts/dev-rocket.mjs')
    game = root / 'games/rocket-arena'
    (game / 'node_modules').mkdir(parents=True)
    (game / 'node_modules/.package-lock.json').write_text('{}')
    legacy = root / 'experiments/rocket-arena-lab'
    (legacy / '.run').mkdir(parents=True)
    secret = 'fixture-original-signing-secret-more-than-32-characters'
    (legacy / '.run/app-ticket-secret').write_text(secret)
    (legacy / '.env.app.local').write_text('APP_ORIGINS=http://legacy-fixture.invalid\n')
    (root / 'bin').mkdir()
    npm = root / 'bin/npm'
    # Stop at the build boundary, after configuration/secret migration. No server runs.
    npm.write_text("#!/usr/bin/env node\nrequire('node:fs').writeFileSync('observed.json',JSON.stringify({origin:process.env.APP_ORIGINS,testHooks:process.env.ROCKET_TEST_HOOKS}));process.exit(17);\n")
    npm.chmod(0o755)
    with socket.socket() as probe:
        probe.bind(('127.0.0.1', 0))
        port = probe.getsockname()[1]
    env = {**os.environ, 'PATH': str(root / 'bin') + os.pathsep + os.environ['PATH'],
           'ROCKET_PORT': str(port), 'SUPABASE_URL': 'http://fixture.invalid',
           'SUPABASE_SECRET_KEY': 'fixture-key', 'ROCKET_TEST_HOOKS': '1'}
    for key in ('ROCKET_TICKET_SECRET', 'APP_ORIGINS'):
        env.pop(key, None)

    def run():
        result = subprocess.run(['node', 'scripts/dev-rocket.mjs'], cwd=root, env=env,
                                capture_output=True, text=True, timeout=10)
        assert result.returncode == 17, result.stdout + result.stderr
        assert (game / '.run/app-ticket-secret').read_text() == secret
        assert (game / '.run/app-ticket-secret').stat().st_mode & 0o777 == 0o600
        observed = json.loads((game / 'observed.json').read_text())
        assert observed['testHooks'] == '0'
        return observed['origin']

    assert run() == 'http://legacy-fixture.invalid'
    # New canonical settings/secret take precedence, and shell overrides still win.
    (legacy / '.run/app-ticket-secret').write_text('fixture-different-old-secret-more-than-32-characters')
    (game / '.env.app.local').write_text('APP_ORIGINS=http://canonical-fixture.invalid\n')
    assert run() == 'http://canonical-fixture.invalid'
    env['APP_ORIGINS'] = 'http://shell-fixture.invalid'
    assert run() == env['APP_ORIGINS']
print(json.dumps({'status': 'PASS', 'legacyLocalSettings': True, 'signingSecretPreserved': True,
                  'canonicalAndShellPrecedence': True, 'testHooksDisabled': True}))
