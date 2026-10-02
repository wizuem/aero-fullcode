/// <reference types="vite/client" />

interface Window {
  $scramjetLoadController?: () => {
    ScramjetController: new (config: {
      prefix: string;
      files: { wasm: string; all: string; sync: string };
    }) => {
      init: () => Promise<void>;
      encodeUrl: (url: string) => string;
    };
  };
  BareMux?: {
    BareMuxConnection: new (workerUrl: string) => {
      setTransport: (path: string, options: unknown[]) => Promise<void>;
    };
  };
  scramjet?: { encodeUrl: (url: string) => string };
}
