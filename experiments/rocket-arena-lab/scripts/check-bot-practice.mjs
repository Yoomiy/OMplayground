import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const base = process.env.LAB_BROWSER_URL ?? 'http://127.0.0.1:19005';
const prefix = process.env.LAB_BOT_QA_PREFIX ?? '.run/bot-practice';
const browser = await chromium.launch({ headless:true,args:[
  '--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader',
] });
const result = { conditions:'One real rendered browser client, VPS socket bots, software WebGL. Functional checks, not device FPS evidence.', cases:[], errors:[],console:[] };
try {
  for (const count of [1,7]) {
    const page=await browser.newPage({viewport:{width:360,height:240}});
    page.on('pageerror',error=>result.errors.push(error.message));
    page.on('console',message=>{if(['warning','error'].includes(message.type()))result.console.push(message.text());});
    await page.goto(base,{waitUntil:'commit'});
    await page.waitForFunction(()=>window.__drivingLab && document.querySelector('#lobby-custom-toggle'));
    await page.evaluate(count=>{
      document.querySelector('#lobby-name').value='אורמן <QA>';
      document.querySelector('#lobby-custom-toggle').click();
      document.querySelector(`#lobby-bots-${count}`).click();
    },count);
    await page.waitForFunction(count=>document.querySelector('#player-count')?.textContent===`${count+1}/8`
      && !document.querySelector('#start-match')?.disabled,count,{timeout:60_000});
    const id=await page.evaluate(()=>{
      if (window.__debugRoom.state.hostSessionId !== window.__debugRoom.sessionId) throw new Error('Human creator must remain host');
      window.__botObservation={snapshots:0,distances:{},acks:{},serverTiming:null,previous:null};
      window.__debugRoom.onMessage('prediction-state',frame=>{
        const s=window.__botObservation;s.snapshots++;s.serverTiming=frame.serverTiming;
        if(s.previous && frame.kickoffEpoch===s.previous.kickoffEpoch && ['playing','overtime'].includes(frame.phase)){
          for(const car of frame.cars){
            const before=s.previous.cars.find(old=>old.sessionId===car.sessionId);
            if(before)s.distances[car.sessionId]=(s.distances[car.sessionId]??0)+Math.hypot(
              car.position.x-before.position.x,car.position.y-before.position.y,car.position.z-before.position.z);
            s.acks[car.sessionId]=car.acknowledgedSequence;
          }
        }
        s.previous=frame;
      });
      document.querySelector('#start-match').click();return window.__debugRoom.id;
    });
    await page.waitForFunction(()=>window.__debugRoom?.state.phase==='playing',{},{timeout:30_000});
    await page.keyboard.down('w');await page.keyboard.down('Shift');
    await page.waitForTimeout(8_000);await page.keyboard.down('a');await page.waitForTimeout(4_000);
    await page.keyboard.up('a');await page.keyboard.up('w');await page.keyboard.up('Shift');
    const metrics=await page.evaluate(()=>({debug:window.__drivingLab.getDebugState(),
      windows:window.__drivingLab.exportTelemetry(),observation:window.__botObservation,
      localId:window.__debugRoom.sessionId,roomId:window.__debugRoom.id,
      language:document.documentElement.lang,
      labels:[...document.querySelectorAll('.player-label')].map(element=>({
        local:element.dataset.local==='true',name:element.querySelector('bdi').textContent,
        direction:element.querySelector('bdi').dir,you:element.querySelector('small').textContent,
        visible:!element.hidden,transform:element.style.transform,
      })),labelImages:document.querySelectorAll('.player-label img').length}));
    assert.equal(metrics.debug.error,null);assert.ok(metrics.debug.pending<=24);
    assert.ok(metrics.debug.predictedCar,'prediction worker completed');
    const bots=Object.keys(metrics.observation.acks).filter(id=>id!==metrics.localId);
    assert.equal(bots.length,count);
    assert.ok(bots.every(id=>metrics.observation.acks[id]>30 && metrics.observation.distances[id]>1));
    assert.ok(Number.isFinite(metrics.observation.serverTiming?.workMs));
    assert.ok(metrics.windows.some(row=>row.phase==='playing' && row.carRendering==='batched'));
    const labelsEnabled=new URL(base).searchParams.get('names')!=='off';
    assert.ok(metrics.windows.some(row=>row.playerLabels===labelsEnabled && row.uiLanguage===metrics.language));
    assert.equal(metrics.labels.length,labelsEnabled?count+1:0);
    if(labelsEnabled){
      const own=metrics.labels.find(label=>label.local);
      assert.equal(own.name,'אורמן <QA>');assert.equal(own.you,metrics.language==='he'?'אני':'You');
      assert.ok(metrics.labels.every(label=>label.direction==='auto'));
      assert.equal(metrics.labelImages,0);
      assert.ok(metrics.labels.some(label=>label.visible && label.transform));
    }
    await page.screenshot({path:`${prefix}-${count}-bots.png`});
    result.cases.push({count,...metrics});
    await page.evaluate(()=>window.__debugRoom.leave());
    await page.waitForFunction(async id=>{
      const rooms=await fetch('/game/matchmake/custom').then(response=>response.json());
      return !rooms.some(room=>room.roomId===id);
    },id,{timeout:15_000});
    await page.waitForFunction(()=>document.querySelectorAll('.player-label').length===0);
    await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:false})));
    assert.equal(await page.locator('.player-label-layer').count(),0);
    await page.close();
    console.log(JSON.stringify({count,result:'PASS',snapshots:metrics.observation.snapshots,
      botAcks:bots.map(id=>metrics.observation.acks[id]),botDistanceMeters:bots.map(id=>metrics.observation.distances[id])}));
  }
  assert.deepEqual(result.errors,[]);
} catch(error) {
  result.failure=String(error);
  result.pages=await Promise.all(browser.contexts().flatMap(context=>context.pages()).map(async page=>({
    url:page.url(),body:await page.locator('body').innerText().catch(()=>''),
    state:await page.evaluate(()=>({room:window.__debugRoom?.id,phase:window.__debugRoom?.state.phase,
      players:window.__debugRoom?.state.totalOccupancy,status:window.__drivingLab?.getDebugState()})).catch(()=>null),
  })));
  console.error(JSON.stringify({failure:result.failure,pages:result.pages,console:result.console,errors:result.errors}));
  throw error;
} finally {
  await browser.close();
  await writeFile(`${prefix}.json`,JSON.stringify(result,null,2)+'\n');
}
