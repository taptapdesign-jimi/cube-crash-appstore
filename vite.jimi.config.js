import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

// Deliberately independent of production postbuild/native bundle synchronization.
export default defineConfig({
  base: './',
  publicDir: false,
  server: { host: '127.0.0.1', port: 5176, strictPort: true },
  build: {
    outDir: 'dist-jimi-2026',
    target: 'es2020',
    rollupOptions: { input: 'jimi-2026.html' },
  },
  plugins: [{
    name: 'jimi-original-assets',
    closeBundle() {
      fs.cpSync(path.resolve('assets'), path.resolve('dist-jimi-2026/assets'), {
        recursive: true,
        filter: source => path.basename(source) !== '.DS_Store',
      });
    },
  }],
});
