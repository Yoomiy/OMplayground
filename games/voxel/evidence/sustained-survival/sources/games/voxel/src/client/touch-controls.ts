import type { VoxelRuntime, HudState } from './runtime.ts';
import './touch-controls.css';

/** Optional UI adapter. It uses the runtime's ordinary controls, never its world or renderer. */
export function mountTouchControls(host: HTMLElement, runtime: VoxelRuntime) {
  const root = document.createElement('div');
  root.className = 'voxel-touch';
  root.setAttribute('aria-label', 'בקרי מגע');
  const aim = document.createElement('div');
  aim.className = 'voxel-touch-aim';
  aim.setAttribute('aria-label', 'גרירה לשינוי כיוון המבט');
  const stick = document.createElement('div');
  stick.className = 'voxel-touch-stick';
  stick.setAttribute('role', 'group');
  stick.setAttribute('aria-label', 'ג׳ויסטיק תנועה');
  const knob = document.createElement('span');
  knob.className = 'voxel-touch-knob';
  knob.setAttribute('aria-hidden', 'true');
  stick.append(knob);
  const actions = document.createElement('div');
  actions.className = 'voxel-touch-actions';
  root.append(aim, stick, actions);
  host.append(root);
  const listeners = new AbortController(),
    signal = listeners.signal;
  const held = new Map<number, 'jump' | 'sneak' | 'sprint' | 'mine'>();
  let movePointer: number | null = null,
    lookPointer: number | null = null;
  let x = 0,
    z = 0,
    lookX = 0,
    lookY = 0,
    centerX = 0,
    centerY = 0,
    radius = 1;
  let disposed = false;
  const commit = () => {
    const values = [...held.values()];
    runtime.command({ type: 'mine', active: values.includes('mine') });
    runtime.command({
      type: 'touch',
      x,
      z,
      jump: values.includes('jump'),
      sneak: values.includes('sneak'),
      sprint: values.includes('sprint'),
    });
  };
  const capture = (element: HTMLElement, event: PointerEvent) => {
    event.preventDefault();
    element.setPointerCapture(event.pointerId);
    runtime.command({ type: 'resume' });
  };
  const reset = () => {
    held.clear();
    movePointer = lookPointer = null;
    x = z = 0;
    knob.style.transform = 'translate(0px, 0px)';
    actions.querySelectorAll('button').forEach((button) => button.classList.remove('held'));
    commit();
  };
  const move = (event: PointerEvent) => {
    if (event.pointerId !== movePointer) return;
    const dx = (event.clientX - centerX) / radius,
      dz = (event.clientY - centerY) / radius;
    const length = Math.hypot(dx, dz),
      scale = Math.max(1, length);
    x = length < 0.12 ? 0 : dx / scale;
    z = length < 0.12 ? 0 : dz / scale;
    knob.style.transform = `translate(${x * radius}px, ${z * radius}px)`;
    commit();
  };
  stick.addEventListener(
    'pointerdown',
    (event) => {
      if (movePointer !== null) return;
      capture(stick, event);
      const rect = stick.getBoundingClientRect();
      centerX = rect.x + rect.width / 2;
      centerY = rect.y + rect.height / 2;
      radius = rect.width * 0.34;
      movePointer = event.pointerId;
      move(event);
    },
    { signal },
  );
  stick.addEventListener('pointermove', move, { signal });
  const stopMove = (event: PointerEvent) => {
    if (event.pointerId !== movePointer) return;
    movePointer = null;
    x = z = 0;
    knob.style.transform = 'translate(0px, 0px)';
    commit();
  };
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'] as const)
    stick.addEventListener(name, stopMove, { signal });
  aim.addEventListener(
    'pointerdown',
    (event) => {
      if (lookPointer !== null) return;
      capture(aim, event);
      lookPointer = event.pointerId;
      lookX = event.clientX;
      lookY = event.clientY;
    },
    { signal },
  );
  aim.addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerId !== lookPointer) return;
      runtime.command({
        type: 'look',
        dx: (event.clientX - lookX) * 2.5,
        dy: (event.clientY - lookY) * 2.5,
      });
      lookX = event.clientX;
      lookY = event.clientY;
    },
    { signal },
  );
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'] as const)
    aim.addEventListener(
      name,
      (event) => {
        if (event.pointerId === lookPointer) lookPointer = null;
      },
      { signal },
    );
  const button = (
    label: string,
    action: () => void,
    hold?: 'jump' | 'sneak' | 'sprint' | 'mine',
  ) => {
    const element = document.createElement('button');
    element.type = 'button';
    element.textContent = label;
    if (hold) element.dataset.control = hold;
    actions.append(element);
    element.addEventListener(
      'pointerdown',
      (event) => {
        capture(element, event);
        if (hold) {
          held.set(event.pointerId, hold);
          element.classList.add('held');
          commit();
        } else action();
      },
      { signal },
    );
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'] as const)
      element.addEventListener(
        name,
        (event) => {
          held.delete(event.pointerId);
          if (hold && ![...held.values()].includes(hold)) element.classList.remove('held');
          commit();
        },
        { signal },
      );
    element.addEventListener(
      'click',
      (event) => {
        if (event.detail === 0) {
          runtime.command({ type: 'resume' });
          action();
        }
      },
      { signal },
    );
    return element;
  };
  button(
    'קפיצה / מעלה',
    () => {
      runtime.command({ type: 'touch', x, z, jump: true, sneak: false, sprint: false });
      commit();
    },
    'jump',
  );
  button('מטה / התכופפות', () => {}, 'sneak');
  button('ריצה', () => {}, 'sprint');
  const flight = button('תעופה', () => runtime.command({ type: 'flight' }));
  const attack = button('תקיפה (Q)', () => runtime.command({ type: 'attack' }));
  const ignite = button('הצתה (G)', () => runtime.command({ type: 'ignite' }));
  button('בנייה', () => runtime.command({ type: 'interact', kind: 'place' }));
  button('כרייה / הסרה', () => {}, 'mine');
  const pause = button('השהיה', () => {
    runtime.command({ type: 'pause' });
    reset();
  });
  const update = (hud: HudState) => {
    root.hidden = hud.inputMode !== 'touch';
    flight.hidden = hud.mode === 'survival' && hud.role !== 'observer';
    attack.hidden = !hud.combat;
    ignite.hidden = !hud.canIgnite;
    ignite.disabled = hud.status !== 'playing';
    attack.disabled = hud.status !== 'playing' || (hud.vitals?.attackCooldown ?? 0) > 0;
    flight.setAttribute('aria-pressed', String(hud.flying));
    if (hud.status !== 'playing') reset();
    pause.disabled = hud.status !== 'playing';
  };
  const unsubscribe = runtime.subscribe(update);
  window.addEventListener('blur', reset, { signal });
  document.addEventListener('visibilitychange', reset, { signal });
  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      reset();
      unsubscribe();
      listeners.abort();
      root.remove();
    },
  };
}
