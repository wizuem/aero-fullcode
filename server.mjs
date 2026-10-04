import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hostname } from 'node:os';
import { server as wisp, logging } from '@mercuryworkshop/wisp-js/server';
import { scramjetPath } from '@mercuryworkshop/scramjet/path';
import { baremuxPath } from '@mercuryworkshop/bare-mux/node';
import { libcurlPath } from '@mercuryworkshop/libcurl-transport';

const epoxyPath = fileURLToPath(new URL('./node_modules/@mercuryworkshop/epoxy-transport/dist/', import.meta.url));

logging.set_level(logging.NONE);

// SSRF blocklist: localhost, private IPs, cloud metadata, internal hostnames
const ssrfBlocklist = [
  /localhost/i,
  /127\./,
  /10\./,
  /172\.(1[6-9]|2[0-9]|3[01])\./,
  /192\.168\./,
  /^0\./,
  /169\.254\./,
  /metadata\.google\.internal/i,
  /::1/,
  /fe80::/i,
  /fd[0-9a-f]{2}:/i,
  /\.internal$/i,
  /\.local$/i,
  /^_[a-z0-9]+\./i,
];

Object.assign(wisp.options, {
  allow_udp_streams: false,
  hostname_blacklist: ssrfBlocklist,
  dns_servers: ['1.1.1.3', '1.0.0.3'],
  wisp_version: 2,
});

// CORS: only allow the deployed frontend origin, never *
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
if (ALLOWED_ORIGINS.length === 0) {
  // Default to same-origin (no CORS header = same-origin only)
  console.warn('[aero] ALLOWED_ORIGINS not set — CORS will be same-origin only');
}

function getCorsHeaders(reqOrigin) {
  if (ALLOWED_ORIGINS.length === 0) {
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
      'Access-Control-Max-Age': '86400',
    };
  }
  const origin = reqOrigin || '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    };
  }
  // Deny - do not send Allow-Origin header
  return { 'Vary': 'Origin' };
}

// Rate limiting: simple in-memory token bucket per IP
const rateBuckets = new Map();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_REQUESTS = 120;

function checkRateLimit(ip) {
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || now - bucket.timestamp > RATE_WINDOW_MS) {
    rateBuckets.set(ip, { timestamp: now, count: 1 });
    return true;
  }
  bucket.count++;
  return bucket.count <= RATE_MAX_REQUESTS;
}

// Request timeout (30 seconds)
const REQUEST_TIMEOUT_MS = 30_000;

// Static file serving with route prefixing
const staticRoutes = [
  { prefix: '/scram/', root: scramjetPath },
  { prefix: '/baremux/', root: baremuxPath },
  { prefix: '/libcurl/', root: libcurlPath },
  { prefix: '/epoxy/', root: epoxyPath },
];

const publicDir = fileURLToPath(new URL('./dist/', import.meta.url));

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

async function serveStaticFile(filePath, res) {
  try {
    if (!existsSync(filePath)) return false;
    const stat = await readFile(filePath);
    const ext = extname(filePath).toLowerCase();
    res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.end(stat);
    return true;
  } catch {
    return false;
  }
}

function serve404(res) {
  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end('<!doctype html><html><body><h1>404 - Not Found</h1></body></html>');
}

function serveIndex(res) {
  const indexPath = join(publicDir, 'index.html');
  readFile(indexPath).then(data => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
    res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
    res.end(data);
  }).catch(() => serve404(res));
}

const server = createServer((req, res) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
  res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');

  const reqOrigin = req.headers.origin || '';
  const corsHeaders = getCorsHeaders(reqOrigin);

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  // Apply CORS headers to all responses
  for (const [key, value] of Object.entries(corsHeaders)) {
    res.setHeader(key, value);
  }

  const clientIp = req.socket.remoteAddress || 'unknown';

  // Rate limiting
  if (!checkRateLimit(clientIp)) {
    res.writeHead(429, { 'Content-Type': 'text/plain', 'Retry-After': '60' });
    res.end('Too Many Requests');
    return;
  }

  // Request timeout
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      res.writeHead(504, { 'Content-Type': 'text/plain' });
      res.end('Gateway Timeout');
    }
  }, REQUEST_TIMEOUT_MS);
  res.on('close', () => clearTimeout(timeout));

  let url = req.url || '/';

  // Try static asset routes first
  for (const route of staticRoutes) {
    if (url.startsWith(route.prefix)) {
      const subPath = normalize(url.slice(route.prefix.length));
      if (subPath.startsWith('..')) {
        serve404(res);
        return;
      }
      const filePath = join(route.root, subPath);
      serveStaticFile(filePath, res).then(served => {
        if (!served) serve404(res);
      });
      return;
    }
  }

  // Serve from dist (the built Vite app)
  if (url === '/' || url === '') {
    serveIndex(res);
    return;
  }

  // Try to serve the file from dist
  const cleanPath = normalize(url).replace(/^\//, '');
  if (cleanPath.startsWith('..')) {
    serve404(res);
    return;
  }
  const filePath = join(publicDir, cleanPath);
  serveStaticFile(filePath, res).then(served => {
    if (!served) {
      // SPA fallback - serve index.html for client-side routing
      if (!url.includes('.')) {
        serveIndex(res);
      } else {
        serve404(res);
      }
    }
  });
});

// Wisp WebSocket upgrade handler
server.on('upgrade', (req, socket, head) => {
  if (req.url && req.url.endsWith('/wisp/')) {
    wisp.routeRequest(req, socket, head);
  } else {
    socket.end();
  }
});

server.on('listening', () => {
  const address = server.address();
  console.log('aero. server listening on:');
  console.log(`  http://localhost:${address.port}`);
  console.log(`  http://${hostname()}:${address.port}`);
});

process.on('SIGINT', () => { server.close(); process.exit(0); });
process.on('SIGTERM', () => { server.close(); process.exit(0); });

let port = parseInt(process.env.PORT || '');
if (isNaN(port)) port = 8080;
server.listen(port, '0.0.0.0');
