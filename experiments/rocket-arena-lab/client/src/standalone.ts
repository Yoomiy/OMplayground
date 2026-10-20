import { mountRocketClient, type RocketClient, type StandaloneUI } from './client.js';
import { createLobby, destroyLobby, showLobby } from './ui/lobby.js';
import { showGameOver, hideGameOver } from './ui/game-over.js';
import { createLabPanel } from './lab/panel.js';
import { createDevPanel, destroyDevPanel } from './dev-panel/dev-panel.js';

const standaloneUI: StandaloneUI = {
  createLobby, destroyLobby, showLobby, showGameOver, hideGameOver,
  createLabPanel, createDevPanel, destroyDevPanel,
};

export function mountStandaloneClient(app: HTMLElement): RocketClient {
  return mountRocketClient(app, undefined, standaloneUI);
}
