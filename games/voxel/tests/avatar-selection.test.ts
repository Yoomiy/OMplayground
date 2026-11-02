import assert from 'node:assert/strict';
import test from 'node:test';
import { AVATAR_POOLS, isAvatarId, selectAvatar } from '../src/shared/avatars.ts';
import { readAuthorization } from '../src/server/admission.ts';
import { parseClientMessage, parseServerMessage } from '../src/shared/protocol.ts';
import { RemoteActors } from '../src/client/interpolation.ts';
import { emptyAppearance } from '../src/shared/appearance.ts';

test('verified gender selects only its explicit pool; guests use a stable full-set fallback', () => {
  for (let i = 0; i < 300; i++)
    for (const gender of ['boy', 'girl'] as const) {
      const id = `player-${i}`,
        avatar = selectAvatar(id, gender);
      assert.ok(AVATAR_POOLS[gender].includes(avatar));
      assert.equal(selectAvatar(id, gender), avatar);
    }
  assert.equal(new Set([...AVATAR_POOLS.boy, ...AVATAR_POOLS.girl]).size, 12);
  for (const id of ['guest', 'admin']) {
    assert.ok(isAvatarId(selectAvatar(id)));
    assert.equal(selectAvatar(id), selectAvatar(id, null));
  }
});
test('authorization carries only a validated selected avatar; browser messages cannot set gender or avatar', () => {
  const now = Date.now(),
    actor = {
      id: 'child',
      role: 'participant',
      avatar: 6,
      capabilities: { build: true, fly: true, observe: false, combat: true, explosives: true },
    };
  assert.equal(readAuthorization({ actor, expiresAt: now + 1000 }, now).actor.avatar, 6);
  for (const avatar of [-1, 12, 1.5, '2', null, false])
    assert.throws(() =>
      readAuthorization({ actor: { ...actor, avatar }, expiresAt: now + 1000 }, now),
    );
  assert.equal(
    parseClientMessage(JSON.stringify({ type: 'avatar', avatar: 6, gender: 'girl' })),
    null,
  );
  assert.equal(
    parseClientMessage(JSON.stringify({ type: 'hello', ticket: 'x', buildId: 'x', avatar: 6 })),
    null,
  );
});
test('public preset survives interpolation and delta updates; malformed and private fields are rejected', () => {
  const actor = {
    id: 'peer',
    state: Array(17).fill(0),
    yaw: 0,
    pitch: 0,
    avatar: 2,
    appearance: emptyAppearance(),
  };
  const joined = (value: unknown) =>
    parseServerMessage(JSON.stringify({ type: 'actor_joined', actor: value }));
  assert.ok(joined(actor));
  assert.equal(joined({ ...actor, gender: 'girl' }), null);
  for (const avatar of [-1, 12, 1.5, '2', null]) assert.equal(joined({ ...actor, avatar }), null);
  const remote = new RemoteActors();
  remote.join(actor, 0);
  assert.equal(remote.frame(0)[0].avatar, 2);
  remote.snapshot([{ id: 'peer', avatar: 6 }], 20, 20);
  assert.equal(remote.frame(20)[0].avatar, 6);
  assert.equal(
    parseServerMessage(
      JSON.stringify({ type: 'snapshot', time: 0, tick: 0, actors: [{ id: 'peer', avatar: 12 }] }),
    ),
    null,
  );
});

test('all six female presets use skirts and all four added IDs reach admission, wire parsing and assignment', async () => {
  const { AVATAR_PRESETS } = await import('../src/render/avatar-presets.ts');
  const { AVATAR_PRESETS: upstream, avatarLook } = await import(
    '../src/render/upstream/blockyard/avatar.ts'
  );
  assert.equal(AVATAR_PRESETS.length, 12);
  assert.equal(AVATAR_POOLS.boy.length, 6);
  assert.equal(AVATAR_POOLS.girl.length, 6);
  for (const id of AVATAR_POOLS.girl)
    assert.equal(avatarLook(AVATAR_PRESETS[id].avatar).bottom, 'skirt', AVATAR_PRESETS[id].name);
  for (const id of AVATAR_POOLS.boy)
    assert.deepEqual(AVATAR_PRESETS[id].avatar, upstream[id].avatar, 'male presets stay unchanged');
  assert.equal(upstream[2].avatar.bottom, 2, 'the imported upstream source is not modified');
  const reached = new Set(Array.from({ length: 300 }, (_, i) => selectAvatar('girl-' + i, 'girl')));
  assert.deepEqual(
    [...reached].sort((a, b) => a - b),
    [...AVATAR_POOLS.girl],
  );
  for (const avatar of [8, 9, 10, 11]) {
    assert.ok(isAvatarId(avatar));
    const now = Date.now(),
      actor = {
        id: 'girl',
        avatar,
        role: 'participant',
        capabilities: { build: true, fly: true, observe: false, combat: true, explosives: true },
      };
    assert.equal(readAuthorization({ actor, expiresAt: now + 1000 }, now).actor.avatar, avatar);
    assert.ok(
      parseServerMessage(
        JSON.stringify({
          type: 'actor_joined',
          actor: {
            id: 'girl',
            avatar,
            state: Array(17).fill(0),
            yaw: 0,
            pitch: 0,
            appearance: emptyAppearance(),
          },
        }),
      ),
    );
  }
});
