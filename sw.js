/* Life Lately v39. Two pages, one origin and one app identity.
 * Caches only public files. IndexedDB, localStorage and decrypted app data are untouched.
 * Activation is explicit while tabs are open; do not reload an unsaved app session.
 */
const CACHE='life-lately-v39-clean-access-20260920';
const ROOT=new URL('./',self.location.href);
const ASSETS=[
  "./",
  "./app/",
  "./styles.css",
  "./core.js",
  "./storage.js",
  "./vendor/supabase-2.116.0.js",
  "./cloud.js",
  "./app.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./404.html",
  "./assets/landing/landing.css",
  "./assets/landing/landing.js",
  "./assets/landing/favicon-original.ico"
];
const canonical=path=>new URL(path,ROOT).href;
const STATIC=new Set(ASSETS.map(canonical));
const LANDING=canonical('./'),APP=canonical('./app/');
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  await cache.addAll(ASSETS);
  // v27 intentionally takes over immediately once: older releases cached the login at '/'.
  // skipWaiting replaces only the service worker; IndexedDB/localStorage financial data is untouched.
  await self.skipWaiting();
})()));
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('life-lately-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
async function fromNetwork(request,cache,key){
 try{
  const response=await fetch(request,{cache:'no-cache'});
  if(response.ok){await cache.put(key,response.clone());return response;}
  return (await cache.match(key))||response;
 }catch{
  const fallback=await cache.match(key);
  return fallback||new Response('Conecte-se à internet para abrir esta página pela primeira vez.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
 }
}
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 if(url.origin!==ROOT.origin||!url.pathname.startsWith(ROOT.pathname))return;
 const relative=url.pathname.slice(ROOT.pathname.length);
 let key=new URL(url.pathname,ROOT.origin).href;
 if(request.mode==='navigate'){
  if(relative===''||relative==='index.html')key=LANDING;
  else if(['app','app/','app/index.html','login','login.html'].includes(relative))key=APP;
  else return; // Unknown URLs remain 404s; never turn every route into the login.
  event.respondWith((async()=>{
   const cache=await caches.open(CACHE);
   if(key===LANDING)return fromNetwork(request,cache,key);
   return (await cache.match(key))||fromNetwork(canonical('./app/'),cache,key);
  })());
  return;
 }
 if(!STATIC.has(key))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  if(relative==='assets/landing/landing.css'||relative==='assets/landing/landing.js'||relative==='manifest.webmanifest')return fromNetwork(request,cache,key);
  return (await cache.match(key))||fromNetwork(request,cache,key);
 })());
});
