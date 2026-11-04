import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import { fileURLToPath } from 'node:url';
function browserBoundaries(): Plugin {
  return {
    name: 'voxel-browser-boundaries',
    generateBundle(_options, bundle) {
      for (const output of Object.values(bundle))
        if (output.type === 'chunk')
          for (const id of Object.keys(output.modules))
            if (/\/src\/(sim|server)\/|\/tools\/|^node:|supabase|livekit-server/.test(id))
              this.error(`Server module reached voxel browser bundle: ${id}`);
    },
  };
}
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  build: { target: 'es2022', outDir: 'dist-client', emptyOutDir: true },
  worker: { format: 'es', plugins: () => [browserBoundaries()] },
  plugins: [browserBoundaries()],
});
