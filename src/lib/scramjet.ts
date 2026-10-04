let scramjetInitialized = false;
let initPromise: Promise<void> | null = null;

declare global {
  interface Window {
    __scramjet$bundle?: {
      rewriters: { url: { encodeUrl(url: string): string } };
    };
    BareMux?: { BareMuxConnection: new (path: string) => BareMuxConnectionInstance };
  }
}

interface BareMuxConnectionInstance {
  setTransport(path: string, options: unknown[]): Promise<void>;
}

export async function initScramjet(): Promise<void> {
  if (scramjetInitialized) return;
  if (initPromise) return initPromise;
  initPromise = doInit();
  return initPromise;
}

async function doInit(): Promise<void> {
  if (!('serviceWorker' in navigator)) throw new Error('Service workers are not supported in this browser');
  if (!window.__scramjet$bundle || !window.BareMux) throw new Error('Proxy assets are unavailable');

  await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  await navigator.serviceWorker.ready;

  const connection = new window.BareMux.BareMuxConnection('/baremux/worker.js');
  await connection.setTransport('/epoxy/index.mjs', [{ wisp: 'wss://wisp.mercurywork.shop/' }]);
  scramjetInitialized = true;
}

export function isScramjetReady(): boolean {
  return scramjetInitialized;
}

export function encodeUrl(url: string): string {
  const bundle = window.__scramjet$bundle;
  if (!bundle) throw new Error('Scramjet is not initialized');
  return bundle.rewriters.url.encodeUrl(url);
}
