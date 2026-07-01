import { createLogger, defineConfig } from 'vite';

const defaultLogger = createLogger();
const MIXED_STATIC_DYNAMIC_IMPORT_MESSAGE = 'dynamic import will not move module into another chunk';

function shouldSuppressBuildWarning(message) {
  return typeof message === 'string' && message.includes(MIXED_STATIC_DYNAMIC_IMPORT_MESSAGE);
}

export default defineConfig({
  base: './',
  customLogger: {
    ...defaultLogger,
    warn(message, options) {
      if (shouldSuppressBuildWarning(message)) return;
      defaultLogger.warn(message, options);
    },
    warnOnce(message, options) {
      if (shouldSuppressBuildWarning(message)) return;
      defaultLogger.warnOnce(message, options);
    }
  },
  build: {
    assetsDir: '',
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
      onwarn(warning, warn) {
        if (warning.code === 'DYNAMIC_IMPORT_WILL_NOT_MOVE_MODULE') return;
        warn(warning);
      },
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
      host: '192.168.1.189',
      port: 5173
    }
  },
  optimizeDeps: {
    include: ['pixi.js', 'gsap']
  }
});
