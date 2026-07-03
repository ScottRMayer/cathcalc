/* Cath Lab Tools — service worker. Cache-first so the app is fully usable offline.
   Bump VERSION whenever any file changes. */
var VERSION = 'cathlab-v2.3.1';
var FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './tests.html',
  './assets/app.css',
  './assets/core.js',
  './assets/icon.svg',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/tests.js',
  './calc/hemodynamics.html',
  './calc/drips.html',
  './calc/heparin.html',
  './calc/act.html',
  './calc/contrast.html',
  './calc/drugs.html',
  './calc/bleed-risk.html',
  './calc/mehran.html',
  './calc/timi.html',
  './calc/zwolle.html'
];
self.addEventListener('install', function(e){
  e.waitUntil(caches.open(VERSION).then(function(c){ return c.addAll(FILES); }).then(function(){ return self.skipWaiting(); }));
});
self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){ return k!==VERSION; }).map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});
self.addEventListener('fetch', function(e){
  if(e.request.method!=='GET')return;
  e.respondWith(
    caches.match(e.request,{ignoreSearch:true}).then(function(hit){
      return hit || fetch(e.request).then(function(res){
        var copy=res.clone();
        caches.open(VERSION).then(function(c){ c.put(e.request,copy); });
        return res;
      });
    })
  );
});
