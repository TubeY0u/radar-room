/* Radar Room – Service Worker.
   App-Dateien: erst Netz, dann Cache (damit Updates ankommen).
   Bilder und Schriften: erst Cache (die ändern sich nie).            */
const VERSION = "rr-v1";
const SHELL = [
  "./", "./index.html", "./app.css", "./app.js", "./sw.js",
  "./config.js", "./maps.js", "./presets.js", "./supabase.min.js",
  "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./icon-180.png",
  "./de_dust2.webp", "./de_mirage.webp", "./de_inferno.webp", "./de_nuke.webp",
  "./de_nuke_lower.webp", "./de_ancient.webp", "./de_anubis.webp", "./de_cache.webp"
];

self.addEventListener("install", e=>{
  e.waitUntil(caches.open(VERSION).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate", e=>{
  e.waitUntil(caches.keys()
    .then(ks=>Promise.all(ks.filter(k=>k!==VERSION).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim()));
});
self.addEventListener("fetch", e=>{
  const req = e.request;
  if(req.method !== "GET") return;
  const url = new URL(req.url);
  if(url.origin !== location.origin) return;          // Supabase & CDN nie cachen

  const isAsset = /\.(webp|png|svg|woff2?)$/.test(url.pathname);
  if(isAsset){
    e.respondWith(caches.match(req).then(hit=>hit || fetch(req).then(res=>{
      const copy = res.clone(); caches.open(VERSION).then(c=>c.put(req,copy)); return res;
    })));
    return;
  }
  e.respondWith(
    fetch(req).then(res=>{
      const copy = res.clone(); caches.open(VERSION).then(c=>c.put(req,copy)); return res;
    }).catch(()=>caches.match(req).then(hit=>hit || caches.match("./index.html")))
  );
});
