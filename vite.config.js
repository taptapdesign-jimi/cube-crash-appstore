import fs from 'node:fs';
import path from 'node:path';
import { createLogger, defineConfig } from 'vite';

const defaultLogger = createLogger();
const MIXED_STATIC_DYNAMIC_IMPORT_MESSAGE = 'dynamic import will not move module into another chunk';
const DEV_SERVER_HOST = process.env.CUBE_CRASH_DEV_HOST || '192.168.1.189';
const DEV_SERVER_PORT = Number(process.env.CUBE_CRASH_DEV_PORT || 5174);

function shouldSuppressBuildWarning(message) {
  return typeof message === 'string' && message.includes(MIXED_STATIC_DYNAMIC_IMPORT_MESSAGE);
}

function manualChunks(id) {
  const normalizedId = id.replace(/\\/g, '/');

  if (normalizedId.includes('/node_modules/pixi.js/')) return 'vendor';
  if (normalizedId.includes('/node_modules/gsap/')) return 'animations';

  if (!normalizedId.includes('/src/')) return undefined;

  if (
    normalizedId.includes('/src/modules/app-core') ||
    normalizedId.includes('/src/modules/app-') ||
    normalizedId.includes('/src/modules/drag-') ||
    normalizedId.includes('/src/modules/hud-') ||
    normalizedId.includes('/src/modules/tile-') ||
    normalizedId.includes('/src/modules/fx') ||
    normalizedId.includes('/src/modules/object-pool') ||
    normalizedId.includes('/src/modules/dom-element-pool') ||
    normalizedId.includes('/src/modules/endgame-') ||
    normalizedId.includes('/src/modules/gameplay-') ||
    normalizedId.includes('/src/modules/final-') ||
    normalizedId.includes('/src/modules/wild-') ||
    normalizedId.includes('/src/modules/tnt-') ||
    normalizedId.includes('/src/modules/magnet-') ||
    normalizedId.includes('/src/modules/merge-')
  ) {
    return 'game-runtime';
  }

  return undefined;
}

function contentTypeFor(filePath) {
  switch (path.extname(filePath).toLowerCase()) {
    case '.html': return 'text/html; charset=utf-8';
    case '.js':
    case '.mjs': return 'text/javascript; charset=utf-8';
    case '.css': return 'text/css; charset=utf-8';
    case '.json':
    case '.webmanifest': return 'application/json; charset=utf-8';
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.gif': return 'image/gif';
    case '.svg': return 'image/svg+xml';
    case '.ico': return 'image/x-icon';
    case '.ttf': return 'font/ttf';
    case '.otf': return 'font/otf';
    case '.woff': return 'font/woff';
    case '.woff2': return 'font/woff2';
    case '.mp3': return 'audio/mpeg';
    case '.wav': return 'audio/wav';
    case '.mp4': return 'video/mp4';
    default: return 'application/octet-stream';
  }
}

export default defineConfig({
  base: './',
  plugins: [
    {
      name: 'cube-crash-native-dev-html',
      configureServer(server) {
        let nativeDevVersion = Date.now();
        const bumpNativeDevVersion = () => {
          nativeDevVersion = Date.now();
        };

        server.watcher.on('add', bumpNativeDevVersion);
        server.watcher.on('change', bumpNativeDevVersion);
        server.watcher.on('unlink', bumpNativeDevVersion);

        server.middlewares.use('/native-dev-version', (_req, res) => {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.end(JSON.stringify({ version: nativeDevVersion }));
        });

        server.middlewares.use('/native-bundle-version', (_req, res) => {
          const indexPath = path.resolve(process.cwd(), 'dist/index.html');
          const version = fs.existsSync(indexPath) ? fs.statSync(indexPath).mtimeMs : 0;
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.end(JSON.stringify({ version }));
        });

        server.middlewares.use('/native-bundle', (req, res) => {
          const distRoot = path.resolve(process.cwd(), 'dist');
          const requestUrl = new URL(req.url || '/', 'http://localhost');
          const rawPath = decodeURIComponent(requestUrl.pathname.replace(/^\/native-bundle\/?/, ''));
          const relativePath = rawPath === '' || rawPath === '/' ? 'index.html' : rawPath.replace(/^\/+/, '');

          if (relativePath.includes('..')) {
            res.statusCode = 400;
            res.end('Bad request');
            return;
          }

          const filePath = path.resolve(distRoot, relativePath);
          if (!filePath.startsWith(distRoot) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
            res.statusCode = 404;
            res.end('Not found');
            return;
          }

          let body = fs.readFileSync(filePath);
          if (relativePath === 'index.html') {
            body = Buffer.from(
              body.toString('utf8').replace(
                '</head>',
                [
                  '  <script>',
                  '    window.__ccNativeBundledDev = true;',
                  '    console.log("✅ CubeCrash native bundled dev loaded from dist");',
                  '    (() => {',
                  '      let currentVersion = null;',
                  '      let reloading = false;',
                  '      const poll = async () => {',
                  '        if (reloading || document.hidden) return;',
                  '        try {',
                  '          const response = await fetch("/native-bundle-version", { cache: "no-store" });',
                  '          const payload = await response.json();',
                  '          if (currentVersion === null) { currentVersion = payload.version; return; }',
                  '          if (payload.version !== currentVersion) {',
                  '            reloading = true;',
                  '            console.log("🔄 CubeCrash native bundled reload", currentVersion, "->", payload.version);',
                  '            location.reload();',
                  '          }',
                  '        } catch (error) {',
                  '          console.warn("⚠️ CubeCrash native bundled reload poll failed", error);',
                  '        }',
                  '      };',
                  '      setInterval(poll, 1000);',
                  '      poll();',
                  '    })();',
                  '  </script>',
                  '</head>'
                ].join('\n')
              ),
              'utf8'
            );
          }

          res.statusCode = 200;
          res.setHeader('Content-Type', contentTypeFor(filePath));
          res.setHeader('Cache-Control', relativePath === 'index.html' ? 'no-store' : 'no-cache');
          res.end(body);
        });

        server.middlewares.use('/native-smoke', (req, res, next) => {
          const requestPath = new URL(req.url || '/', 'http://localhost').pathname;
          if (requestPath !== '/' && requestPath !== '') {
            next();
            return;
          }

          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.end(`<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>CubeCrash Native Smoke</title>
  <style>
    html, body { margin: 0; min-height: 100%; background: #14332b; color: #fff; font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
    body { display: grid; place-items: center; }
    main { text-align: center; padding: 28px; }
    h1 { margin: 0 0 10px; font-size: 28px; }
    p { margin: 6px 0; font-size: 15px; opacity: 0.86; }
  </style>
</head>
<body>
  <main>
    <h1>NATIVE SMOKE OK</h1>
    <p>WKWebView can load ${DEV_SERVER_HOST}:${DEV_SERVER_PORT}</p>
    <p id="tick"></p>
  </main>
  <script>
    console.log("✅ CubeCrash native smoke loaded");
    document.getElementById("tick").textContent = new Date().toISOString();
  </script>
</body>
</html>`);
        });

        server.middlewares.use('/native-dev', (req, res, next) => {
          const requestPath = new URL(req.url || '/', 'http://localhost').pathname;
          if (requestPath !== '/' && requestPath !== '') {
            next();
            return;
          }

          const indexPath = path.resolve(process.cwd(), 'index.html');
          let html = fs.readFileSync(indexPath, 'utf8');
          html = html
            .replace(/src="\.\/src\/modules\/launch-screen-init\.ts"/g, `src="./src/modules/launch-screen-init.ts?nativeDevVersion=${nativeDevVersion}"`)
            .replace(/src="\.\/src\/main\.ts"/g, `src="./src/main.ts?nativeDevVersion=${nativeDevVersion}"`);
          html = html.replace(
            '</head>',
            [
              '  <base href="/">',
              '  <script>',
              '    window.__ccNativeDevNoViteClient = true;',
              '    console.log("✅ CubeCrash native dev HTML loaded without /@vite/client");',
              '    (() => {',
              '      let currentVersion = null;',
              '      let reloading = false;',
              '      const poll = async () => {',
              '        if (reloading || document.hidden) return;',
              '        try {',
              '          const response = await fetch("/native-dev-version", { cache: "no-store" });',
              '          const payload = await response.json();',
              '          if (currentVersion === null) { currentVersion = payload.version; return; }',
              '          if (payload.version !== currentVersion) {',
              '            reloading = true;',
              '            console.log("🔄 CubeCrash native dev reload", currentVersion, "->", payload.version);',
              '            location.reload();',
              '          }',
              '        } catch (error) {',
              '          console.warn("⚠️ CubeCrash native dev reload poll failed", error);',
              '        }',
              '      };',
              '      setInterval(poll, 1000);',
              '      poll();',
              '    })();',
              '  </script>',
              '</head>'
            ].join('\n')
          );
          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.end(html);
        });
      }
    }
  ],
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
        manualChunks
      }
    },
    chunkSizeWarningLimit: 1000
  },
  server: {
    host: true, // Allows access from network (iOS simulator)
    port: DEV_SERVER_PORT,
    strictPort: true,
    hmr: {
      protocol: 'ws',
      host: DEV_SERVER_HOST,
      port: DEV_SERVER_PORT
    }
  },
  optimizeDeps: {
    include: ['pixi.js', 'gsap']
  }
});
