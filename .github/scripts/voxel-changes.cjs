const { execFileSync } = require('node:child_process');
const { appendFileSync } = require('node:fs');

// Run conservatively when the comparison cannot be established (new branches,
// force pushes with missing history, or manual dispatches).
let relevant = true;
if (process.env.EVENT_NAME !== 'workflow_dispatch' && /^[0-9a-f]{40}$/.test(process.env.BASE_SHA || '') && !/^0+$/.test(process.env.BASE_SHA)) {
  try {
    const range = process.env.EVENT_NAME === 'pull_request'
      ? `${process.env.BASE_SHA}...HEAD`
      : `${process.env.BASE_SHA}..HEAD`;
    const files = execFileSync('git', ['diff', '--name-only', '-z', range], { encoding: 'utf8' }).split('\0');
    relevant = files.some(file => /^(games\/voxel\/|apps\/voxel-server\/|apps\/web\/src\/game\/voxel\/|\.github\/workflows\/voxel\.yml$|\.github\/scripts\/voxel-changes\.cjs$)/.test(file));
  } catch (error) {
    console.warn('Could not compare changes; running Voxel checks:', error.message);
  }
}
console.log(`Voxel checks required: ${relevant}`);
appendFileSync(process.env.GITHUB_OUTPUT, `voxel=${relevant}\n`);
