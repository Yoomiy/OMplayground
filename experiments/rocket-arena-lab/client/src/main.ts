import { mountStandaloneClient } from './standalone.js';
import { startEmbeddedClient } from './platform/bridge.js';

const app = document.getElementById('app')!;
if (new URLSearchParams(window.location.search).get('embed') === '1') {
  void startEmbeddedClient(app).catch(() => {
    app.textContent = 'לא ניתן לפתוח את המשחק. יש לחזור למגרש המשחקים ולנסות שוב.';
  });
} else mountStandaloneClient(app);
