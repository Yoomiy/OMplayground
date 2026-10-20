import { defineConfig } from 'vite';
import { resolve } from 'path';

const backendTarget = `http://127.0.0.1:${process.env.LAB_SERVER_PORT ?? '2567'}`;

export default defineConfig({
  plugins: [{
    name: 'rocket-app-entry',
    transformIndexHtml: {
      order: 'pre',
      handler: html => process.env.VITE_ROCKET_APP_ONLY === '1'
        ? html.replace('src="/src/main.ts"', 'src="/src/app.ts"') : html,
    },
  }],
  resolve: {
    alias: {
      '@rocket-arena/shared': resolve(__dirname, '../shared/src'),
      '@rocket-arena/simulation': resolve(__dirname, '../simulation/src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    proxy: {
      '/game': {
        target: backendTarget,
        ws: true,
        rewrite: (path) => path.replace(/^\/game/, ''),
      },
    },
    fs: {
      // Allow serving files from the parent directory (monorepo root)
      // This is needed because shared/ is outside client/
      allow: [
        resolve(__dirname, '..'),
      ],
    },
  },
  preview: {
    host: '0.0.0.0', port: 3000, strictPort: true, allowedHosts: true,
    proxy: {
      '/game': { target: backendTarget, ws: true,
        rewrite: (path) => path.replace(/^\/game/, '') },
    },
  },
});
