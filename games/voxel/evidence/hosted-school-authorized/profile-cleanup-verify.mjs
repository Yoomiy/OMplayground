import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createSupabaseServerClient } from '/home/ubuntu/OMplayground/apps/voxel-server/src/supabase-persistence.ts';
const folders = ['/tmp/voxel-hosted-school-KKdL8j', '/tmp/voxel-hosted-school-t4PKyQ'];
const journals = folders.map(folder => JSON.parse(readFileSync(folder + '/journal.json', 'utf8')));
const ids = new Set(journals.flatMap(journal => [journal.teacher, journal.kid]));
assert.equal(ids.size, 4);
const client = createSupabaseServerClient(process.env, async (input, init) => {
  const request = new Request(input, init), url = new URL(request.url);
  assert.equal(url.origin, new URL(process.env.SUPABASE_URL).origin);
  assert.equal(request.method, 'GET');
  assert.equal(url.pathname, '/rest/v1/kid_profiles');
  assert(ids.has(url.searchParams.get('id')?.slice(3)));
  assert(url.searchParams.get('id')?.startsWith('eq.'));
  assert.equal(url.searchParams.get('select'), 'id');
  return fetch(request);
});
const results = [];
for (const id of ids) {
  const response = await client.from('kid_profiles').select('id').eq('id', id).maybeSingle().retry(false);
  assert.equal(response.error, null);
  assert.equal(response.data, null);
  results.push({ id, profileAbsent: true });
}
const report = { result: 'PASS', scope: 'Four exact synthetic profile IDs from the two approved attempts; GET only', results };
writeFileSync('/tmp/voxel-hosted-profile-cleanup-verify.json', JSON.stringify(report, null, 2) + '\n');
console.log('HOSTED_SYNTHETIC_PROFILE_CLEANUP_PASS', results.length);
