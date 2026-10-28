import { mountVoxel } from './runtime.ts';
import type { VoxelRuntime } from './runtime.ts';
import { mountTouchControls } from './touch-controls.ts';
import { mountInventoryControls } from './inventory-controls.ts';
import { content } from './engine.ts';
import './style.css';
import { ITEM_LABELS as names } from './content-labels.ts';
const host = document.querySelector<HTMLElement>('#world')!,
  status = document.querySelector<HTMLElement>('#status')!,
  bar = document.querySelector<HTMLElement>('#hotbar')!;
const room = new URL(location.href).searchParams.get('room') ?? 'creative';
let runtime: VoxelRuntime | undefined, timer: ReturnType<typeof setInterval> | undefined;
let touchControls: ReturnType<typeof mountTouchControls> | undefined;
let inventoryControls: ReturnType<typeof mountInventoryControls> | undefined;
try {
  runtime = await mountVoxel(host, {
    renderScale: new URL(location.href).searchParams.get('quality') === 'low' ? 0.5 : 1,
    renderHz: new URL(location.href).searchParams.get('quality') === 'low' ? 30 : 60,
    socketUrl: `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/voxel`,
    admit: async () => {
      const response = await fetch('/api/voxel/admission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room }),
      });
      if (!response.ok) throw new Error('admission failed');
      return response.json();
    },
    onDiagnostic: (operation, reason) => console.warn('voxel development', { operation, reason }),
  });
  const buttons = new Map<number, HTMLButtonElement>();
  touchControls = mountTouchControls(host, runtime);
  inventoryControls = mountInventoryControls(bar, runtime, content, names);
  runtime.subscribe((state) => {
    document.querySelector('.toolbar strong')!.textContent =
      state.mode === 'survival' ? 'עולם ההישרדות' : 'עולם הבנייה';
    document.querySelector('.toolbar small')!.textContent =
      state.mode === 'survival'
        ? 'WASD לתנועה · רווח לקפיצה · לחיצה שמאלית לכרייה או תקיפה · Q לתקיפה · ימנית לבנייה · R לאכילה'
        : 'WASD לתנועה · רווח לקפיצה · F לתעופה · לחיצה שמאלית להסרה · ימנית לבנייה';
    const vitals = document.querySelector<HTMLElement>('#vitals')!;
    const eat = document.querySelector<HTMLButtonElement>('#eat')!;
    const respawn = document.querySelector<HTMLButtonElement>('#respawn')!;
    vitals.hidden = eat.hidden = state.mode !== 'survival' || state.role === 'observer';
    if (state.vitals)
      vitals.textContent = `בריאות ${state.vitals.health}/20 · מזון ${state.vitals.food}/20${state.vitals.air < 300 ? ` · אוויר ${Math.ceil(state.vitals.air / 30)}` : ''}${state.vitals.protection ? ` · הגנת חזרה ${Math.ceil(state.vitals.protection / 30)}` : ''}`;
    const hit = document.querySelector<HTMLOutputElement>('#hit-feedback')!;
    if (state.hit && hit.dataset.at !== String(state.hit.at)) {
      hit.dataset.at = String(state.hit.at);
      hit.textContent = `${state.hit.received ? 'נפגעתם' : 'פגיעה'} · ${state.hit.damage}`;
      hit.getAnimations().forEach((animation) => animation.cancel());
      hit.animate(
        [
          { opacity: 1, transform: 'translate(-50%,0)' },
          { opacity: 0, transform: 'translate(-50%,-18px)' },
        ],
        { duration: 750, fill: 'forwards' },
      );
    } else if (!state.hit) hit.textContent = '';
    eat.disabled =
      state.status !== 'playing' ||
      state.inventoryPending ||
      state.vitals?.food === 20 ||
      !content.items.find((i) => i.itemType === state.inventory?.bag[state.selectedSlot]?.itemType)
        ?.food;
    respawn.hidden = state.status !== 'dead';
    respawn.disabled = state.vitals?.respawnIn !== 0;
    const resume = document.querySelector<HTMLButtonElement>('#resume')!;
    resume.hidden = state.status === 'dead';
    const effects = document.querySelector<HTMLButtonElement>('#effects');
    if (effects) {
      effects.hidden = !state.effectsAvailable;
      effects.textContent = state.effectsMuted ? 'קולות משחק: כבויים' : 'קולות משחק: פעילים';
      effects.setAttribute('aria-pressed', String(state.effectsMuted));
    }
    const environment = document.querySelector('#environment');
    if (environment)
      environment.textContent = `${String(state.environment.hour).padStart(2, '0')}:00 · ${state.environment.rain ? 'גשם' : state.environment.daytime ? 'יום בהיר' : 'לילה בהיר'}`;
    status.textContent = state.message || `${state.players} בעולם${state.flying ? ' · תעופה' : ''}`;
    const mining = document.querySelector<HTMLProgressElement>('#mining');
    if (mining) {
      mining.hidden = !state.mining.target;
      mining.value = state.mining.total ? state.mining.elapsed / state.mining.total : 0;
    }
    if (
      buttons.size !== state.hotbar.length ||
      state.hotbar.some((item) => !buttons.has(item.key))
    ) {
      for (const b of buttons.values()) b.remove();
      buttons.clear();
    }
    for (const item of state.hotbar) {
      let button = buttons.get(item.key);
      if (!button) {
        button = document.createElement('button');
        buttons.set(item.key, button);
        bar.append(button);
        button.onclick = () =>
          runtime!.command(
            item.slot === null
              ? { type: 'select', state: item.state }
              : { type: 'select-slot', slot: item.slot },
          );
      }
      const text = `${item.slot === null ? '' : `${item.slot + 1}. `}${item.family ? (names[item.family] ?? item.family) : 'יד ריקה'}${item.count ? ` ×${item.count}` : ''}`;
      if (button.textContent !== text) button.textContent = text;
      const selected =
        item.slot === null ? item.state === state.selected : item.slot === state.selectedSlot;
      if (button.getAttribute('aria-pressed') !== String(selected))
        button.setAttribute('aria-pressed', String(selected));
      button.classList.toggle('selected', selected);
    }
  });
  document
    .querySelector('#eat')!
    .addEventListener('click', () => runtime!.command({ type: 'eat' }));
  document
    .querySelector('#respawn')!
    .addEventListener('click', () => runtime!.command({ type: 'respawn' }));
  document
    .querySelector('#resume')!
    .addEventListener('click', () => runtime!.command({ type: 'resume' }));
  document
    .querySelector('#fullscreen')!
    .addEventListener('click', () => runtime!.command({ type: 'fullscreen' }));
  document
    .querySelector('#reconnect')!
    .addEventListener('click', () => runtime!.command({ type: 'reconnect' }));
  document.querySelector('#effects')!.addEventListener('click', () => {
    const muted = document.querySelector('#effects')!.getAttribute('aria-pressed') === 'true';
    runtime!.command({ type: 'mute-effects', muted: !muted });
  });
  {
    (window as unknown as { voxel: VoxelRuntime }).voxel = runtime;
    timer = setInterval(() => {
      const state = runtime!.debug() as { disposed: boolean };
      if (state.disposed) {
        touchControls?.dispose();
        inventoryControls?.dispose();
        clearInterval(timer);
        return;
      }
      document.querySelector('#diagnostics pre')!.textContent = JSON.stringify(state, null, 2);
    }, 500);
  }
} catch (error) {
  status.textContent = error instanceof Error ? error.message : 'לא ניתן להפעיל את המשחק';
}
window.addEventListener(
  'pagehide',
  () => {
    clearInterval(timer);
    touchControls?.dispose();
    inventoryControls?.dispose();
    runtime?.dispose();
  },
  { once: true },
);
