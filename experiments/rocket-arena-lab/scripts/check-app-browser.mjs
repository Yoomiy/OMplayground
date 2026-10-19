import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');

/** Actual React app container + built game frame, with fixture identities. */
export async function runBrowserChecks(origin, sessionId, freezeForLateJoin, failSave) {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ viewport: { width: 640, height: 480 } });
  const errors = [];
  const consoleErrors = [];
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  const startupWarnings = [];
  const inspectConsole = entry => {
    const text = entry.text();
    if (/Allow attribute|target origin provided|onMessage\(\) not registered/.test(text)) startupWarnings.push(text);
    if (entry.type() === 'error') consoleErrors.push(text);
  };
  page.on('console', inspectConsole);
  try {
    await page.goto(`${origin}/rocket-integration-qa.html?qaUser=1`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /^התחלת משחק/ }).waitFor({ timeout: 60_000 });
    const gameFrame = () => page.frames().find(frame => frame.url().includes('embed=1'));
    await page.waitForFunction(() => !!document.querySelector('iframe')?.contentWindow);
    await gameFrame().waitForFunction(() => window.__debugRoom && window.__drivingLab, null, { timeout: 60_000 });
    const roomId = await gameFrame().evaluate(() => window.__debugRoom.id);
    assert.ok(roomId);
    assert.equal(await gameFrame().locator('#lobby').count(), 0);
    assert.equal(await page.locator('bdi').filter({ hasText: 'אורמן <QA>' }).count(), 2);
    await page.getByRole('button', { name: 'מסך מלא', exact: true }).click();
    await page.waitForFunction(() => !!document.fullscreenElement?.querySelector('iframe'));
    await page.getByRole('button', { name: 'יציאה ממסך מלא', exact: true }).click();
    await page.waitForFunction(() => !document.fullscreenElement);
    assert.equal(await page.getByLabel('מספר בוטים').inputValue(), '0');
    await page.getByRole('button', { name: 'העברת אורמן <QA> לקבוצה כתומה', exact: true }).click();
    await gameFrame().waitForFunction(() => window.__debugRoom?.state.hostSessionId === 'rocket-1'
      && window.__debugRoom.state.players.size === 1 && window.__debugRoom.state.players.get('rocket-1').isHost);
    await page.waitForTimeout(350);
    await page.getByRole('button', { name: 'העברת אורמן <QA> לקבוצה כחולה', exact: true }).click();
    await gameFrame().waitForFunction(() => window.__debugRoom?.state.hostSessionId === 'rocket-0');
    await page.waitForTimeout(350);
    await page.getByLabel('מספר בוטים').selectOption('7');
    await page.getByRole('button', { name: 'התחלת משחק (8 מכוניות)', exact: true }).waitFor();
    await page.waitForTimeout(350);
    await page.getByRole('button', { name: 'העברת אורמן <QA> לקבוצה כתומה', exact: true }).click();
    await page.getByRole('button', { name: 'העברת אורמן <QA> לקבוצה כחולה', exact: true }).waitFor();
    await page.getByRole('button', { name: 'צ׳אט וקול', exact: true }).click();
    await page.getByLabel('הודעה לחדר').fill('שלום מהדפדפן');
    await page.getByRole('button', { name: 'שלח', exact: true }).click();
    await page.getByLabel('הודעות', { exact: true }).getByText('שלום מהדפדפן', { exact: false }).waitFor();
    await page.getByRole('button', { name: 'הצטרף לצ׳אט הקולי', exact: true }).waitFor();
    await page.screenshot({ path: new URL('../.run/app-lobby-light.png', import.meta.url).pathname });
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await page.waitForTimeout(300); // Let the shared 200ms theme transition settle.
    await page.screenshot({ path: new URL('../.run/app-lobby-dark.png', import.meta.url).pathname });
    await page.evaluate(() => document.documentElement.classList.remove('dark'));
    await page.getByRole('button', { name: 'חזרה למשחק', exact: true }).click();
    await page.waitForTimeout(350);
    await page.getByRole('button', { name: /^התחלת משחק/ }).click();
    await gameFrame().waitForFunction(() => window.__debugRoom?.state?.phase === 'playing', null, { timeout: 15_000 });
    await gameFrame().locator('canvas').click();
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(1500);
    await page.keyboard.up('KeyW');
    await gameFrame().waitForFunction(() => window.__drivingLab.getDebugState().acknowledgedSequence > 0, null, { timeout: 15_000 });
    const driving = await gameFrame().evaluate(() => window.__drivingLab.getDebugState());
    assert.ok(driving.snapshots > 5);
    await gameFrame().locator('.player-label[data-local=true]').waitFor();
    assert.equal(await gameFrame().locator('.player-label').count(), 8);
    const oldConnection = await gameFrame().evaluate(() => {
      window.__qaCanvas = document.querySelector('canvas');
      const connection = window.__debugRoom.sessionId;
      window.__debugRoom.connection.close();
      return connection;
    });
    await gameFrame().waitForFunction(previous => window.__debugRoom?.sessionId && window.__debugRoom.sessionId !== previous,
      oldConnection, { timeout: 20_000 });
    await page.waitForFunction(() => !document.body.innerText.includes('מתחבר מחדש'));
    if (await page.getByRole('button', { name: 'המשך משחק', exact: true }).count()) await page.getByRole('button', { name: 'המשך משחק', exact: true }).click();
    await page.getByRole('button', { name: 'השהיית משחק', exact: true }).waitFor();
    assert.equal(await gameFrame().evaluate(() => document.querySelector('canvas') === window.__qaCanvas), true);
    const connectedId = await gameFrame().evaluate(() => {
      const params = new URL(location.href).searchParams;
      parent.postMessage({ source: 'rocket-frame', version: 1, bridgeId: params.get('bridgeId'), kind: 'error', code: 'PLATFORM_UNAVAILABLE' }, params.get('parentOrigin'));
      return window.__debugRoom.sessionId;
    });
    await page.getByRole('alert').filter({ hasText: 'מסד הנתונים' }).waitFor();
    await page.waitForTimeout(1800);
    assert.equal(await gameFrame().evaluate(() => window.__debugRoom.sessionId), connectedId);
    await page.getByRole('button', { name: 'השהיית משחק', exact: true }).click();
    await page.getByRole('button', { name: 'המשך משחק', exact: true }).waitFor();
    await page.waitForTimeout(200); // Drain the last pre-pause schema patch before sampling its frozen clock.
    const pausedTick = await gameFrame().evaluate(() => window.__debugRoom.state.timeRemaining);
    await page.waitForTimeout(500);
    assert.equal(await gameFrame().evaluate(() => window.__debugRoom.state.timeRemaining), pausedTick);
    await page.getByRole('button', { name: 'המשך משחק', exact: true }).click();
    await page.getByRole('button', { name: 'השהיית משחק', exact: true }).waitFor();

    await freezeForLateJoin(true);
    const friend = await context.newPage();
    friend.on('pageerror', error => errors.push(error.message));
    friend.on('console', inspectConsole);
    await friend.goto(`${origin}/rocket-integration-qa.html?qaUser=2`, { waitUntil: 'domcontentloaded' });
    await friend.getByText('ממתינים לבעיטת הפתיחה הבאה כדי להצטרף', { exact: true }).waitFor({ timeout: 60_000 });
    await page.setViewportSize({ width: 1280, height: 720 });
    assert.equal(await page.getByRole('button', { name: 'שיבוץ המצטרפים', exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'הצגת שחקנים בחדר', exact: true }).isVisible(), false);
    await page.getByLabel('שיבוץ חבר 2', { exact: true }).selectOption('rocket-6');
    await page.waitForFunction(() => document.querySelector('select[aria-label="שיבוץ חבר 2"]')?.value === 'rocket-6');
    await page.setViewportSize({ width: 640, height: 480 });
    await friend.getByRole('button', { name: 'הצגת שחקנים בחדר', exact: true }).click();
    await friend.getByText('מיועד לקבוצה הכחולה', { exact: true }).waitFor();

    // Another origin/source cannot replace launch state or grant staff controls.
    await page.evaluate(({ sessionId }) => window.postMessage({ source: 'rocket-frame', version: 1,
      bridgeId: new URL(document.querySelector('iframe').src).searchParams.get('bridgeId'), kind: 'state',
      state: { sessionId, canModerate: true } }, location.origin), { sessionId });
    assert.equal(await page.getByRole('button', { name: 'הסרה', exact: true }).count(), 0);
    await freezeForLateJoin(false);
    await page.getByRole('button', { name: 'סיום משחק', exact: true }).click();
    await page.getByRole('button', { name: 'משחק חוזר', exact: true }).waitFor();
    await page.getByLabel('תוצאה', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'שיבוץ המצטרפים', exact: true }).count(), 0);
    const oldFrameSrc = await page.locator('iframe').getAttribute('src');
    await page.getByRole('button', { name: 'משחק חוזר', exact: true }).click();
    await friend.getByRole('button', { name: 'כן, משחק חוזר', exact: true }).click();
    await page.waitForFunction(previous => document.querySelector('iframe')?.src !== previous, oldFrameSrc);
    await page.frameLocator('iframe').locator('canvas').waitFor({ timeout: 60_000 });
    await page.getByRole('button', { name: /^התחלת משחק/ }).waitFor({ timeout: 60_000 });
    await friend.getByRole('region', { name: 'חדר המתנה', exact: true }).waitFor({ timeout: 60_000 });
    await page.waitForFunction(() => document.querySelector('select[aria-label="מספר בוטים"]')?.value === '6');
    assert.equal(await page.getByLabel('מספר בוטים').inputValue(), '6');
    const rejoined = await gameFrame().waitForFunction(() => {
      const room = window.__debugRoom;
      return room?.connection.isOpen && room.state?.phase === 'waiting' ? room.id : false;
    }, null, { timeout: 30_000 });
    assert.notEqual(await rejoined.jsonValue(), roomId);
    await rejoined.dispose();
    await friend.close();
    await failSave();
    await page.getByRole('alert').filter({ hasText: 'לא התקבל אישור לשמירת המשחק' }).waitFor();
    assert.equal(await page.getByText('המשחק נשמר ל־24 שעות.', { exact: false }).count(), 0);
    await page.getByRole('button', { name: 'ניסיון נוסף', exact: true }).click();
    await page.getByRole('button', { name: /^התחלת משחק/ }).waitFor({ timeout: 60_000 });
    await gameFrame().locator('canvas').waitFor({ timeout: 60_000 });
    await page.evaluate(() => {
      const element = document.querySelector('iframe');
      const url = new URL(element.src);
      element.contentWindow.postMessage({ source: 'playground-app', version: 1, kind: 'dispose',
        bridgeId: url.searchParams.get('bridgeId') }, url.origin);
    });
    await gameFrame().waitForFunction(() => !document.querySelector('canvas') && !window.__drivingLab);
    assert.deepEqual(errors, []);
    assert.deepEqual(startupWarnings, []);
    return { status: 'PASS', parent: 'actual RocketSessionContainer', backend: 'real Colyseus/Rapier',
      identity: 'fixture Supabase API', hebrewNames: true, authoritativeInputs: true, pauseResume: true,
      optionalBotsAndTeamControls: true, soloTeamSwitch: true, persistedChat: true, voicePanel: true, rematchFrameCleanup: true, multiplayerRematch: true, directRosterAssignment: true, desktopRosterShortcutRemoved: true, strictModeStartupWarnings: startupWarnings,
      lateJoinWaiting: true, hostRecruitAssignment: true, roomRoster: true, fullscreen: true, reconnectPreservesRenderer: true, saveFailureAndRetry: true, disposedFrame: true, foreignMessageRejected: true, browserErrors: errors, driving };
  } catch (error) {
    const pages = await Promise.all(context.pages().map(async item => ({ url: item.url(),
      text: await item.locator('body').innerText().catch(() => ''), frames: item.frames().map(frame => frame.url()) })));
    console.error('App browser failure', { pages, errors, consoleErrors });
    throw error;
  } finally { await browser.close(); }
}
