/* Cath Lab Tools — service worker.
   HTML is served network-first (so a deploy can never pair new markup with old
   JS/CSS); versioned static assets are cache-first and keyed on VERSION, so a
   VERSION bump swaps the whole asset set atomically.
   Bump VERSION (and keep CM.VERSION in core.js in step) whenever any file changes. */
var VERSION = 'cathlab-v3.10.0';
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
  './assets/icon-maskable-192.png',
  './assets/icon-maskable-512.png',
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
/* HTML/navigation -> network-first (fall back to cache offline), so markup and
   its assets always come from the same deploy. Other GETs (css/js/img) ->
   cache-first from the VERSION cache, revalidating in the background. */
self.addEventListener('fetch', function(e){
  var req=e.request;
  if(req.method!=='GET')return;
  if(req.url.indexOf('http')!==0)return;
  var isNav = req.mode==='navigate' ||
    (req.headers.get('accept')||'').indexOf('text/html')>=0;
  if(isNav){
    /* network-first, but raced against a 2.5s timer so slow hospital Wi-Fi
       falls back to the cached page instead of hanging. A late network
       response still lands in the cache for next time. */
    e.respondWith(new Promise(function(resolve,reject){
      var settled=false;
      var net=fetch(req).then(function(res){
        if(res&&res.status===200&&res.type==='basic'){
          var copy=res.clone(); caches.open(VERSION).then(function(c){ c.put(req,copy); });
        }
        if(!settled){ settled=true; clearTimeout(timer); resolve(res); }
        return res;
      });
      function fromCache(){
        caches.match(req,{ignoreSearch:true}).then(function(hit){
          return hit || caches.match('./index.html');
        }).then(function(hit){
          /* nothing cached (first visit): fall back to whatever the network does */
          if(hit) resolve(hit); else net.then(resolve,reject);
        });
      }
      var timer=setTimeout(function(){
        if(settled)return; settled=true; fromCache();
      },2500);
      net.catch(function(){
        if(settled)return; settled=true; clearTimeout(timer); fromCache();
      });
    }));
    return;
  }
  e.respondWith(
    caches.open(VERSION).then(function(c){
      return c.match(req,{ignoreSearch:true}).then(function(hit){
        var net=fetch(req).then(function(res){
          if(res&&res.status===200&&res.type==='basic'){ c.put(req,res.clone()); }
          return res;
        }).catch(function(){ return hit; });
        return hit || net;
      });
    })
  );
});
