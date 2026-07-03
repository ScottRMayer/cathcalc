/* Cath Lab Tools — service worker. Cache-first so the app is fully usable offline.
   Bump VERSION whenever any file changes. */
var VERSION = 'cathlab-v3.1.0';
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
  './calc/dyevert.html',
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
/* Stale-while-revalidate: serve instantly from cache (fast + offline), but always
   fetch a fresh copy in the background and update the cache. This means the NEXT
   load after any deploy is current, even if VERSION wasn't bumped. */
self.addEventListener('fetch', function(e){
  if(e.request.method!=='GET')return;
  if(e.request.url.indexOf('http')!==0)return;
  e.respondWith(
    caches.open(VERSION).then(function(c){
      return c.match(e.request,{ignoreSearch:true}).then(function(hit){
        var net=fetch(e.request).then(function(res){
          if(res&&res.status===200&&res.type==='basic'){ c.put(e.request,res.clone()); }
          return res;
        }).catch(function(){ return hit; });
        return hit || net;
      });
    })
  );
});
