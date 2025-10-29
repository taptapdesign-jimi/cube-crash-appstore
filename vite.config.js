import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2020',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn']
      },
      mangle: {
        safari10: true
      }
    },
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['pixi.js'],
          animations: ['gsap']
        }
      }
    },
    chunkSizeWarningLimit: 1000
  },
  server: {
    host: true, // Allows access from network (iOS simulator)
    port: 5173,
    strictPort: true, // Fail if port 5173 is already in use
    hmr: {
      protocol: 'ws',
      host: 'localhost'
    }
  },
  optimizeDeps: {
    include: ['pixi.js', 'gsap']
  }
});