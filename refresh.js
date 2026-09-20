(async()=>{
 const target='./app/?v=40&refreshed=1';
 try{
  const scope=new URL('./',location.href).href;
  if('serviceWorker'in navigator){
   const registrations=await navigator.serviceWorker.getRegistrations();
   await Promise.all(registrations.filter(registration=>registration.scope===scope).map(registration=>registration.unregister()));
  }
  if('caches'in globalThis){
   const names=await caches.keys();
   await Promise.all(names.filter(name=>name.startsWith('life-lately-')).map(name=>caches.delete(name)));
  }
 }finally{
  location.replace(target);
 }
})();
