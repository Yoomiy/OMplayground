import { mountRocketClient } from './client.js';
import { startEmbeddedClient } from './platform/bridge.js';

const app = document.getElementById('app')!;
if (new URLSearchParams(window.location.search).get('embed') === '1') {
  void startEmbeddedClient(app).catch(() => {
    app.textContent = 'לא ניתן לפתוח את המשחק. יש לחזור למגרש המשחקים ולנסות שוב.';
  });
} else if (import.meta.env.VITE_ROCKET_APP_ONLY === '1') {
  app.textContent = 'יש לפתוח את המשחק מתוך מגרש המשחקים.';
} else mountRocketClient(app);
