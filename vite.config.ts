import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname, normalize, resolve } from 'node:path';
import { cpSync, mkdirSync } from 'node:fs';

// Hard-coded paths to Mercury Workshop package dist directories.
// We avoid importing them directly in the Vite config because the
// rolldown config bundler in WebContainers cannot resolve them.
const projectRoot = fileURLToPath(new URL('.', import.meta.url));
const scramjetPath = resolve(projectRoot, 'node_modules/@mercuryworkshop/scramjet/dist');
const baremuxPath = resolve(projectRoot, 'node_modules/@mercuryworkshop/bare-mux/dist');
const libcurlPath = resolve(projectRoot, 'node_modules/@mercuryworkshop/libcurl-transport/dist');
const epoxyPath = resolve(projectRoot, 'node_modules/@mercuryworkshop/epoxy-transport/dist');

const staticRoutes = [
  { prefix: '/scram/', root: scramjetPath },
  { prefix: '/baremux/', root: baremuxPath },
  { prefix: '/libcurl/', root: libcurlPath },
  { prefix: '/epoxy/', root: epoxyPath },
];

const mimeTypes: Record<string, string> = {
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.map': 'application/json; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
};

function serveScramjetAssets(): Plugin {
  return {
    name: 'serve-scramjet-assets',

    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || '';
        for (const route of staticRoutes) {
          if (url.startsWith(route.prefix)) {
            const subPath = normalize(url.slice(route.prefix.length));
            if (subPath.startsWith('..')) {
              res.writeHead(403);
              res.end('Forbidden');
              return;
            }
            const filePath = join(route.root, subPath);
            if (existsSync(filePath)) {
              const ext = extname(filePath).toLowerCase();
              res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
              res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
              res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
              try {
                const data = readFileSync(filePath);
                res.writeHead(200);
                res.end(data);
              } catch {
                res.writeHead(500);
                res.end('Internal Error');
              }
              return;
            }
            res.writeHead(404);
            res.end('Not Found');
            return;
          }
        }
        next();
      });

      // Wisp WebSocket handler — loaded lazily so it doesn't break config bundling
      server.httpServer.on('upgrade', async (req, socket, head) => {
        if (req.url && req.url.endsWith('/wisp/')) {
          try {
            const { server: wisp, logging } = await import('@mercuryworkshop/wisp-js/server');
            logging.set_level(logging.NONE);
            wisp.routeRequest(req, socket, head);
          } catch {
            socket.end();
          }
        } else if (!req.url?.startsWith('/@') && !req.url?.startsWith('/node_modules')) {
          socket.end();
        }
      });
    },

    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || '';
        for (const route of staticRoutes) {
          if (url.startsWith(route.prefix)) {
            const subPath = normalize(url.slice(route.prefix.length));
            if (subPath.startsWith('..')) {
              res.writeHead(403);
              res.end('Forbidden');
              return;
            }
            const filePath = join(route.root, subPath);
            if (existsSync(filePath)) {
              const ext = extname(filePath).toLowerCase();
              res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
              try {
                const data = readFileSync(filePath);
                res.writeHead(200);
                res.end(data);
              } catch {
                res.writeHead(500);
                res.end('Internal Error');
              }
              return;
            }
            res.writeHead(404);
            res.end('Not Found');
            return;
          }
        }
        next();
      });

      server.httpServer.on('upgrade', async (req, socket, head) => {
        if (req.url && req.url.endsWith('/wisp/')) {
          try {
            const { server: wisp, logging } = await import('@mercuryworkshop/wisp-js/server');
            logging.set_level(logging.NONE);
            wisp.routeRequest(req, socket, head);
          } catch {
            socket.end();
          }
        } else {
          socket.end();
        }
      });
    },

    closeBundle() {
      const distDir = fileURLToPath(new URL('./dist/', import.meta.url));
      for (const route of staticRoutes) {
        const targetDir = join(distDir, route.prefix.replace(/^\//, ''));
        mkdirSync(targetDir, { recursive: true });
        cpSync(route.root, targetDir, { recursive: true });
        console.log(`[scramjet] copied ${route.prefix} assets to dist`);
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), serveScramjetAssets()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react', '@mercuryworkshop/scramjet', '@mercuryworkshop/bare-mux', '@mercuryworkshop/libcurl-transport'],
  },
  server: {
    fs: {
      allow: [projectRoot, scramjetPath, baremuxPath, libcurlPath, epoxyPath],
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
  },
});
