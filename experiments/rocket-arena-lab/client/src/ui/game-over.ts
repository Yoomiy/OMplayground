import { t, textDirection, UI_FONT } from './i18n.js';
import { showLobby } from './lobby.js';
import { getRoom } from '../networking/client.js';
import { getLocalState } from '../networking/state-listener.js';
import type { Room } from 'colyseus.js';

let gameOverEl: HTMLElement | null = null;
let style: HTMLStyleElement | null = null;

export function showGameOver(room: Room): void {
  if (getRoom() !== room || getLocalState()?.phase !== 'ended') return;
  hideGameOver();
  const state = getLocalState();
  const blueScore = state?.blueScore || 0;
  const orangeScore = state?.orangeScore || 0;
  const winner = t(blueScore > orangeScore ? 'BLUE WINS!' : 'ORANGE WINS!');
  const winColor = blueScore > orangeScore ? '#3366ff' : '#ff6633';

  gameOverEl = document.createElement('div');
  gameOverEl.id = 'game-over';
  gameOverEl.dir = textDirection;
  gameOverEl.innerHTML = `
    <div class="game-over-card">
      <h2 style="color: ${winColor}">${winner}</h2>
      <p class="game-over-score" dir="ltr">${blueScore} - ${orangeScore}</p>
      <button id="game-over-replay">${t("Play Again")}</button>
    </div>
  `;

  style = document.createElement('style');
  style.textContent = `
    #game-over { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.8); z-index: 60; font-family: ${UI_FONT}; }
    .game-over-card { text-align: center; padding: 2rem; }
    .game-over-card h2 { font-size: 3rem; margin-bottom: 1rem; text-shadow: 0 4px 8px rgba(0,0,0,0.5); }
    .game-over-score { font-size: 2rem; color: #fff; margin-bottom: 2rem; }
    .game-over-card button { padding: 1rem 2rem; background: #3366ff; color: #fff; border: none; border-radius: 8px; font-size: 1.2rem; cursor: pointer; font-family: ${UI_FONT}; }
    .game-over-card button:hover { background: #4477ff; }
  `;
  document.head.appendChild(style);
  document.body.appendChild(gameOverEl);

  document.getElementById('game-over-replay')!.addEventListener('click', () => {
    hideGameOver();
    showLobby();
  });
}

export function hideGameOver(): void {
  style?.remove();
  style = null;
  if (gameOverEl) {
    gameOverEl.remove();
    gameOverEl = null;
  }
}
