import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const prefix = process.argv[2] ?? '.run/render-scaling';
await build({ entryPoints: ['scripts/render-scaling-scene.ts'], bundle: true,
  platform: 'browser', format: 'iife', globalName: 'RenderScaling', outfile: `${prefix}.js`,
  alias: { '@rocket-arena/shared': resolve('shared/src/index.ts') } });
const browser = await chromium.launch({ headless: true, args: [
  '--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader',
] });
const page = await browser.newPage({ viewport: { width: 360, height: 240 } });
const errors = [], results = [];
const screenshots = new Map();
page.on('pageerror', error => errors.push(error.message));
try {
  await page.setContent('<style>body{margin:0}</style>');
  await page.addScriptTag({ path: `${prefix}.js` });
  for (const batched of [false, true]) for (const quality of ['standard', 'low']) for (const boosting of [false, true]) {
    for (const players of [2, 8, 8, 2]) {
      const samples = await page.evaluate(async ({ players, quality, boosting, batched }) => {
        window.RenderScaling.configure(players, quality, boosting, batched);
        const samples = [];
        for (let i = 0; i < 4; i++) {
          await new Promise(requestAnimationFrame);
          const sample = window.RenderScaling.frame();
          if (i >= 2) samples.push(sample);
        }
        return samples;
      }, { players, quality, boosting, batched });
      assert.ok(samples.every(sample => sample.visibleCars === players));
      assert.ok(samples.every(sample => sample.drawCalls === samples[0].drawCalls && sample.triangles === samples[0].triangles));
      results.push({ players, quality, boosting, batched, ...samples[0] });
      console.log(JSON.stringify(results.at(-1)));
      if (quality === 'standard' && players === 8) screenshots.set(`${batched}:${boosting}`,
        await page.screenshot({ path: `${prefix}-8-${batched ? 'batched' : 'original'}-${boosting ? 'boost' : 'plain'}.png` }));
    }
  }
  assert.deepEqual(errors, []);
  const imageComparisons = [];
  for (const boosting of [false, true]) {
    const comparison = await page.evaluate(async ({a,b}) => {
      const decode = async bytes => {
        const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)], {type:'image/png'}));
        const canvas = document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
        const context=canvas.getContext('2d');context.drawImage(bitmap,0,0);bitmap.close();
        return context.getImageData(0,0,canvas.width,canvas.height).data;
      };
      const left=await decode(a),right=await decode(b);let max=0,sum=0,changed=0;
      for(let i=0;i<left.length;i+=4){let different=false;for(let c=0;c<3;c++){
        const delta=Math.abs(left[i+c]-right[i+c]);max=Math.max(max,delta);sum+=delta;different ||= delta>0;
      }if(different)changed++;}
      return {changedPixels:changed,maxChannelDelta:max,meanChannelDelta:sum/(left.length/4*3)};
    }, {a:[...screenshots.get(`false:${boosting}`)],b:[...screenshots.get(`true:${boosting}`)]});
    imageComparisons.push({boosting,...comparison});
  }
  console.log(JSON.stringify({imageComparisons}));
  await writeFile(`${prefix}.json`, JSON.stringify({
    conditions: 'Fixed camera and scene, simplified ceiling, shadows off, production arena/car/ball/pad models, all cars in view. Alternating 2/8/8/2 after warmup; optional all-car boost effects. Low setting changes exterior visibility and resolution. Submitted draw/triangle counts only; no device CPU, GPU-time or FPS claim.',
    results, imageComparisons, errors,
  }, null, 2) + '\n');
} finally {
  await page.evaluate(() => window.RenderScaling?.dispose()).catch(() => {});
  await browser.close();
}
