import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import path from 'node:path';
import { rmSync } from 'node:fs';
export default defineConfig({
  plugins: [react(), {
    name: 'omit-source-texture-atlas',
    apply: 'build',
    closeBundle() {
      // Fighter GLBs embed their textures. Keep the editable atlas in source only.
      rmSync(path.resolve(import.meta.dirname, 'dist/models/fighter-face-atlas.png'), { force: true });
    },
  }],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, '.') } },
  server: {
    host: '0.0.0.0',
    port: 5173,
    watch: { usePolling: true, useFsEvents: false },
  },
  build: { target: 'es2022', chunkSizeWarningLimit: 1800 },
});
