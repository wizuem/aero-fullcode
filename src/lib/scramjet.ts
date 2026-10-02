let scramjetInitialized = false;
let initPromise: Promise<void> | null = null;

interface ScramjetConfig {
  prefix: string;
  files: {
    wasm: string;
    all: string;
    sync: string;
  };
}

interface ScramjetControllerInstance {
  init(): Promise<void>;
  encodeUrl(url: string): string;
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
  await waitForGlobals();

  if (!('serviceWorker' in navigator)) {
    throw new Error('Service workers are not supported in this browser');
  }

  await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  await navigator.serviceWorker.ready;

  const { ScramjetController } = window.$scramjetLoadController!();
  const controller = new ScramjetController({
    prefix: '/service/',
    files: {
      wasm: '/scram/scramjet.wasm.wasm',
      all: '/scram/scramjet.all.js',
      sync: '/scram/scramjet.sync.js',
    },
  });

  window.scramjet = controller;
  await controller.init();

  const connection = new window.BareMux!.BareMuxConnection('/baremux/worker.js');
  await connection.setTransport('/epoxy/index.mjs', [
    { wisp: 'wss://wisp.mercurywork.shop/' },
  ]);

  scramjetInitialized = true;
}

function waitForGlobals(): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('Scramjet scripts failed to load within 15 seconds')),
      15000,
    );
    const check = () => {
      if (window.$scramjetLoadController && window.BareMux) {
        clearTimeout(timeout);
        resolve();
      } else {
        requestAnimationFrame(check);
      }
    };
    check();
  });
}

export function isScramjetReady(): boolean {
  return scramjetInitialized;
}

export function encodeUrl(url: string): string {
  if (!window.scramjet) {
    throw new Error('Scramjet is not initialized');
  }
  return window.scramjet.encodeUrl(url);
}
