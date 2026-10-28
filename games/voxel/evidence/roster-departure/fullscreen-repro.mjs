import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {launchSoftwareBrowser} from '/home/ubuntu/OMplayground/games/voxel/tools/browser-harness.ts';
const browser=await launchSoftwareBrowser(),results=[];
try {
  for(let i=0;i<8;i++) {
    const context=await browser.newContext({viewport:{width:900,height:650}}),page=await context.newPage();
    try {
      await page.setContent(`<main id="root"><button id="enter" onclick="document.querySelector('main').requestFullscreen()">Enter fullscreen</button><button id="exit" onclick="window.exits=(window.exits??0)+1;document.querySelector('main').remove()">Exit</button></main><script>window.events=[];for(const type of ['pointerdown','mousedown','pointerup','mouseup','click','fullscreenchange'])document.addEventListener(type,e=>events.push({type,target:e.target.id,time:performance.now(),fullscreen:!!document.fullscreenElement}),true)</script>`);
      await page.locator('#enter').click();
      await page.waitForFunction(()=>!!document.fullscreenElement);
      let acknowledged=true;
      try {await page.locator('#exit').click({timeout:3000});}
      catch(error) {if(error.name!=='TimeoutError')throw error;acknowledged=false;}
      const state=await page.evaluate(()=>({root:!!document.querySelector('main'),fullscreen:!!document.fullscreenElement,exits:window.exits,events:window.events}));
      assert.equal(state.root,false);assert.equal(state.fullscreen,false);assert.equal(state.exits,1);
      results.push({acknowledged,...state});
    } finally {await context.close();}
  }
} finally {await browser.close();}
const result={browser:browser.version(),scope:'Standalone DOM fullscreen root removal; no React, game renderer, workers, network or database',samples:results,acknowledgementTimeouts:results.filter(r=>!r.acknowledged).length};
writeFileSync('/tmp/voxel-fullscreen-repro.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({samples:results.length,acknowledgementTimeouts:result.acknowledgementTimeouts}));
