importScripts('/scram/scramjet.codecs.js', '/scram/scramjet.bundle.js', '/scram/scramjet.worker.js');

self.__scramjet$config = {
  prefix: '/service/',
  codec: self.__scramjet$codecs.plain,
  config: '/scram/scramjet.config.js',
  bundle: '/scram/scramjet.bundle.js',
  worker: '/scram/scramjet.worker.js',
  client: '/scram/scramjet.client.js',
  codecs: '/scram/scramjet.codecs.js',
};

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (event) => {
  event.respondWith((async () => {
    await scramjet.loadConfig();
    return scramjet.route(event) ? scramjet.fetch(event) : fetch(event.request);
  })());
});
