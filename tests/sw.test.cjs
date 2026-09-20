/* v40 service-worker unit tests: an in-memory Cache adapter, no real installation. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const dir=path.join(__dirname,'..'),base='https://example.test/',handlers={},deleted=[];
let skipped=0,claimed=0,calls=0,installed=[],offline=false,count=0;
const url=x=>new URL(typeof x==='string'?x:x.url,base).href;
const stored=new Map();
function response(k){const pathname=new URL(k).pathname;return new Response(['/', '/index.html'].includes(pathname)?'LANDING':pathname==='/app/'?'LOGIN':'ASSET '+k,{headers:{'Content-Type':'text/html'}});}
const cache={addAll:async a=>{installed=[...a];for(const x of a)stored.set(url(x),response(url(x)));},match:async k=>stored.get(url(k))?.clone(),put:async(k,r)=>stored.set(url(k),r.clone())};
const current='life-lately-v40-network-first-20260920';
const caches={open:async()=>cache,keys:async()=>['life-lately-v24-cofrinhos-20260919','life-lately-v25-landing-20260919','life-lately-v29-nav-20260919','life-lately-v30-nav-20260919','life-lately-v31-logo-20260919','life-lately-v32-navigation-20260919','life-lately-v33-wordmark-20260919','life-lately-v34-strategic-20260919','life-lately-v36-cloud-access-20260919','life-lately-v37-three-access-options-20260919','life-lately-v38-google-label-center-20260920','life-lately-v39-clean-access-20260920','unrelated-cache',current],delete:async k=>{deleted.push(k);return true;}};
const self={location:{origin:'https://example.test',href:base+'sw.js'},addEventListener:(k,f)=>handlers[k]=f,skipWaiting:()=>{skipped++;},clients:{claim:async()=>{claimed++;}}};
vm.runInNewContext(fs.readFileSync(path.join(dir,'sw.js'),'utf8'),{self,caches,URL,Set,Response,fetch:async r=>{calls++;if(offline)throw Error('Offline simulated');return response(url(r));}});
function ok(name){count++;console.log('✓',name);}
async function request(p,mode='navigate',method='GET'){
 let result;
 handlers.fetch({request:{url:new URL(p,base).href,method,mode},respondWith:p=>result=p});
 return result?await result:null;
}
(async()=>{
 let pending;handlers.install({waitUntil:p=>pending=p});await pending;
 for(const x of installed){const p=path.join(dir,x.endsWith('/')?x+'index.html':x);assert(fs.existsSync(p),'Missing precache file '+x);}
 ok('Todos os arquivos do precache existem no pacote, incluindo landing e app');
 assert.equal(skipped,1);ok('Instalar assume o controle para substituir caches antigos');
 handlers.message({data:{type:'SKIP_WAITING'}});assert.equal(skipped,2);ok('A ativação pode ser solicitada explicitamente');
 handlers.activate({waitUntil:p=>pending=p});await pending;assert.deepEqual(deleted,['life-lately-v24-cofrinhos-20260919','life-lately-v25-landing-20260919','life-lately-v29-nav-20260919','life-lately-v30-nav-20260919','life-lately-v31-logo-20260919','life-lately-v32-navigation-20260919','life-lately-v33-wordmark-20260919','life-lately-v34-strategic-20260919','life-lately-v36-cloud-access-20260919','life-lately-v37-three-access-options-20260919','life-lately-v38-google-label-center-20260920','life-lately-v39-clean-access-20260920']);assert.equal(claimed,1);ok('Só os caches antigos do Life Lately são removidos');
 assert.equal(await(await request('/')).text(),'LANDING');assert.equal(await(await request('/index.html')).text(),'LANDING');ok('Raiz e index.html apresentam a landing');
 for(const p of ['/app/','/app/index.html','/app','/login','/login.html'])assert.equal(await(await request(p)).text(),'LOGIN');ok('Endereços do app apresentam login, nunca a landing');
 offline=true;assert.equal(await(await request('/')).text(),'LANDING');assert.equal(await(await request('/index.html?teste=1')).text(),'LANDING');ok('Landing tem fallback offline sem depender de sessão financeira');
 assert.equal(await(await request('/app/')).text(),'LOGIN');assert.equal(await(await request('/app/index.html?teste=1')).text(),'LOGIN');ok('Login tem fallback offline separado');
 const before=calls;const core=await request('/core.js','same-origin');assert(core);assert.equal(calls,before+1);ok('Arquivos mutáveis tentam a rede e usam o cache offline');
 const beforeVendor=calls;const vendor=await request('/vendor/supabase-2.116.0.js','same-origin');assert(vendor);assert.equal(calls,beforeVendor);ok('Bibliotecas imutáveis continuam cache-first');
 assert(await request('/assets/landing/landing.css','same-origin'));assert(await request('/assets/landing/favicon-original.ico','same-origin'));ok('CSS e identidade visual têm fallback offline');
 assert.equal(await request('/rota-inexistente'),null);assert.equal(await request('/app/inexistente'),null);ok('URLs inexistentes não são transformadas em página de login');
 assert.equal(await request('https://other.test/file.js','same-origin'),null);assert.equal(await request('/api','same-origin','POST'),null);assert.equal(await request('/backup.json','same-origin'),null);ok('Não intercepta serviços externos, gravações nem arquivos de dados');
 const manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.webmanifest'),'utf8'));
 assert.equal(new URL(manifest.id,base).href,base);assert.equal(new URL(manifest.start_url,base+'manifest.webmanifest').href,base+'app/');assert.equal(manifest.scope,'./');
 for(const i of manifest.icons)assert(fs.existsSync(path.join(dir,i.src)));ok('PWA mantém a identidade antiga e inicia em /app/');
 const app=fs.readFileSync(path.join(dir,'app/index.html'),'utf8');assert(app.includes('src="../core.js?v=40"'));assert(app.includes('href="../manifest.webmanifest"'));assert(!app.includes('assets/landing/landing.css'));ok('HTML de login usa recursos versionados do app, sem misturar CSS da landing');
 console.log(`\n${count} verificações de service worker / pacote concluídas (simulação).`);
})().catch(e=>{console.error(e);process.exit(1);});
