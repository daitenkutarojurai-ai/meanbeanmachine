import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths: works at a domain root, under GitHub Pages' /repo/ path, and inside a mobile app shell.
  base: './',
  server: {
    port: 5173,
    proxy: {
      '/ws': { target: 'ws://localhost:8787', ws: true },
    },
  },
  build: {
    outDir: 'dist',
    target: 'es2022',
  },
});
