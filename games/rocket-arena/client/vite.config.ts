import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: { alias: {
    '@rocket-arena/shared': resolve(__dirname, '../shared/src'),
    '@rocket-arena/simulation': resolve(__dirname, '../simulation/src'),
  } },
});
