import { t, textDirection, UI_FONT, labStatus, ltr } from '../ui/i18n.js';
import type { DrivingMode } from './prediction.js';
import { WorkerDrivingLab } from './worker-driving-lab.js';
import type { TimingProfileName } from './timing-profile.js';

export function createLabPanel(lab: WorkerDrivingLab, timingProfile: TimingProfileName = lab.timingProfile): () => void {
  const panel = document.createElement('section');
  panel.id = 'driving-lab';
  panel.dir = textDirection;
  panel.setAttribute('aria-label', t('Driving comparison'));
  panel.innerHTML = `
    <strong>${t("Driving test")}</strong>
    <label for="lab-mode">${t("Response")}</label>
    <select id="lab-mode">
      <option value="predicted">${t("Local prediction")}</option>
      <option value="shorter">${t("Shorter delay \u00b7 40 ms")}</option>
      <option value="original">${t("Original delay \u00b7 100 ms")}</option>
    </select>
    <small id="lab-description"></small>
    <output id="lab-status"></output>
    <small id="lab-telemetry"></small>
    <button id="lab-download" type="button">${t("Download test data")}</button>
    <small id="lab-release"></small>
  `;
  const styles = document.createElement('style');
  styles.textContent = `
    #driving-lab { position: fixed; right: 12px; top: 12px; z-index: 2000;
      width: 260px; padding: 14px; border: 1px solid #52787f; border-radius: 12px;
      background: #10222bf2; color: #eef7f7; font: 13px/1.5 ${UI_FONT};
      box-shadow: 0 8px 30px #0005; }
    #driving-lab strong { display: block; font-size: 15px; margin-bottom: 6px; }
    #driving-lab label { display: block; }
    #driving-lab select { width: 100%; padding: 7px; margin: 4px 0 8px;
      border-radius: 6px; background: #203f49; color: white; border: 1px solid #7fa5ab; }
    #driving-lab small, #driving-lab output { display: block; }
    #lab-description { color: #b6d6da; margin-bottom: 6px; }
    #lab-status { font-variant-numeric: tabular-nums; }
    #lab-download { margin-top: 8px; cursor: pointer; }
    @media (max-width: 700px) { #driving-lab { width: 215px; font-size: 11px; padding: 8px; } }
  `;
  document.head.append(styles);
  document.body.append(panel);
  panel.querySelector('#lab-release')!.textContent = t('Build: {build} · Test: {test}', { build: ltr(import.meta.env.VITE_LAB_RELEASE ?? 'development'), test: ltr(timingProfile) });
  panel.querySelector('#lab-download')!.addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(lab.exportTelemetry(), null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'rocket-arena-playtest.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1_000);
    (panel.querySelector('#lab-download') as HTMLButtonElement).blur();
  });
  const select = panel.querySelector('select')!;
  select.value = lab.mode;
  select.addEventListener('change', () => {
    lab.setMode(select.value as DrivingMode);
    select.blur();
  });
  const descriptions: Record<DrivingMode, string> = {
    predicted: lab.poseBufferMs > 0
      ? t('Local driving with a 50 ms pose buffer. Corrections may appear during collisions.')
      : t('Local driving with the previous presentation filter. Corrections may appear during collisions.'),
    shorter: t('Server movement with a smaller smoothing buffer.'),
    original: t('Server movement with the upstream smoothing delay.'),
  };
  const timer = window.setInterval(() => {
    select.value = lab.mode;
    panel.querySelector('#lab-description')!.textContent = descriptions[lab.mode];
    panel.querySelector('#lab-status')!.textContent = labStatus(lab.status);
    const latest = lab.latestTelemetry;
    panel.querySelector('#lab-telemetry')!.textContent = latest && latest.mode === lab.mode && latest.eligibleMs > 0
      ? t('Last window: {active}% prediction active · frame p95 ≤ {frame} ms', { active: Math.round(latest.predictionActivePercent), frame: latest.frameMs.p95Upper.toFixed(0) })
        + (latest.predictionChecks ? t(' · {confirmed}% updates confirmed', { confirmed: Math.round(latest.confirmedSnapshots / latest.predictionChecks * 100) }) : '')
      : t('Collecting foreground play measurements…');
  }, 250);
  return () => { clearInterval(timer); panel.remove(); styles.remove(); };
}
