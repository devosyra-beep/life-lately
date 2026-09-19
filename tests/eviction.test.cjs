/* Despejo de armazenamento: cadastro sobrevive, carga salva some.
 * Regressão do pior cenário do app — abrir um espaço vazio por cima de dados recuperáveis.
 * WebCrypto é real; a I/O do navegador é emulada, como nas demais suítes. */
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {webcrypto}=require('node:crypto'),LL=require('../core.js');
const source=fs.readFileSync(path.join(__dirname,'../storage.js'),'utf8');
function memory(){return {local:new Map(),dbs:new Map(),locks:new Map(),failDelete:false};}
function instance(m=memory(),storage=null){
 const localStorage={getItem:k=>m.local.get(k)||null,setItem:(k,v)=>m.local.set(k,String(v)),removeItem:k=>m.local.delete(k)};
 const indexedDB={open(name){let data=m.dbs.get(name);const isNew=!data;if(!data){data=new Map();m.dbs.set(name,data);}const r={};setImmediate(()=>{r.result={objectStoreNames:{contains:()=>true},createObjectStore(){},close(){},transaction(){const t={error:null};t.objectStore=()=>({get(k){const q={};setImmediate(()=>{q.result=structuredClone(data.get(k));q.onsuccess?.();});return q;},put(v,k){setImmediate(()=>{data.set(k,structuredClone(v));t.oncomplete?.();});},delete(k){setImmediate(()=>{if(m.failDelete){t.error=Error('blocked delete');t.onerror?.();}else{data.delete(k);t.oncomplete?.();}});}});return t;}};if(isNew)r.onupgradeneeded?.();r.onsuccess?.();});return r;}};
 const navigator={locks:{request:(name,fn)=>{const q=(m.locks.get(name)||Promise.resolve()).catch(()=>{}).then(fn);m.locks.set(name,q);return q;}}};
 if(storage)navigator.storage=storage;
 const context=vm.createContext({LL,crypto:webcrypto,localStorage,indexedDB,navigator,TextEncoder,TextDecoder,Uint8Array,atob,btoa,structuredClone,console,setTimeout,clearTimeout});
 vm.runInContext(source,context);
 return {S:context.LLStore,m};
}
/* O sistema libera espaço apagando IndexedDB e o espelho em localStorage.
 * A chave de cadastro é pequena e costuma sobreviver — é exatamente esse o caso perigoso. */
function evict(S,m){m.dbs.clear();m.local.delete(S.keys.FALLBACK);}
let checks=0;async function test(name,fn){await fn();checks++;console.log('✓',name);}

(async()=>{
 await test('Cadastro sem carga salva recusa a abertura em vez de entregar um app vazio',async()=>{
  const{S,m}=instance();
  const s=await S.create('Ana','password-new');LL.income(s,{value:500});await S.save(s);await S.lock();
  evict(S,m);
  const err=await S.unlock('password-new').then(()=>null,e=>e);
  assert(err,'unlock deveria ter recusado');
  assert.equal(err.code,'no-data');
  assert.match(err.message,/n\u00e3o foram encontrados/i);
  assert.equal(S.isUnlocked(),false);
 });

 await test('A recusa não grava nada: o espaço continua vazio para o backup entrar',async()=>{
  const{S,m}=instance();
  await S.create('Ana','password-new');await S.lock();
  evict(S,m);
  await S.unlock('password-new').catch(()=>{});
  assert.equal(m.dbs.get(S.keys.DB_NAME)?.has('state')||false,false);
  assert.equal(m.local.get(S.keys.FALLBACK),undefined);
  assert(S.readAccount(),'o cadastro deve ser preservado para identificar a pessoa');
 });

 await test('Depois do despejo, o backup restaura os dados por inteiro',async()=>{
  const{S,m}=instance();
  const s=await S.create('Ana','password-new');
  LL.upsertPocket(s,{label:'Aluguel',targetAmount:1200,targetDate:LL.afterMonths(1)});
  LL.income(s,{value:800});
  const text=JSON.stringify(await S.backup(s));
  await S.lock();evict(S,m);
  await assert.rejects(()=>S.unlock('password-new'),/n\u00e3o foram encontrados/i);
  const prepared=await S.inspectBackup(text,'password-new');
  await S.restore(prepared);await S.lock();
  const back=await S.unlock('password-new');
  assert.equal(LL.summary(back).lifetimeIncome,800);
  assert.equal(LL.cats(back).some(c=>c.label==='Aluguel'),true);
 });

 await test('Recomeçar do zero exige a senha correta',async()=>{
  const{S,m}=instance();
  await S.create('Ana','password-new');await S.lock();evict(S,m);
  await assert.rejects(()=>S.discardOrphanAccount('senha-errada'),/n\u00e3o confere/i);
  assert(S.readAccount(),'cadastro intacto depois de senha errada');
 });

 await test('Recomeçar do zero é recusado enquanto houver dados salvos',async()=>{
  const{S}=instance();
  const s=await S.create('Ana','password-new');LL.income(s,{value:100});await S.save(s);await S.lock();
  await assert.rejects(()=>S.discardOrphanAccount('password-new'),/H\u00e1 dados salvos/i);
  assert.equal(LL.summary(await S.unlock('password-new')).lifetimeIncome,100);
 });

 await test('Recomeçar do zero libera o aparelho para um cadastro novo',async()=>{
  const{S,m}=instance();
  await S.create('Ana','password-new');await S.lock();evict(S,m);
  await S.discardOrphanAccount('password-new');
  assert.equal(S.readAccount(),null);
  const fresh=await S.create('Bia','password-two');
  assert.equal(fresh.profile.name,'Bia');
  assert.equal(fresh.transactions.length,0);
 });

 await test('Login comum não sinaliza migração, então o app não regrava o banco',async()=>{
  const{S,m}=instance();
  const s=await S.create('Ana','password-new');LL.income(s,{value:100});await S.save(s);await S.lock();
  const other=instance(m).S;
  await other.unlock('password-new');
  assert.equal(other.wasMigrated(),false);
 });

 await test('Esquema antigo sinaliza migração para que a regravação aconteça uma vez',async()=>{
  const{S,m}=instance();
  const s=await S.create('Ana','password-new');s.version=9;await S.save(s);await S.lock();
  const other=instance(m).S;
  await other.unlock('password-new');
  assert.equal(other.wasMigrated(),true);
 });

 await test('Pedido de armazenamento persistente é idempotente e nunca lança',async()=>{
  const sem=instance().S;
  const flat=async r=>({supported:r.supported,persisted:r.persisted});
  assert.deepEqual(await flat(await sem.persist()),{supported:false,persisted:false});
  assert.equal(await sem.estimate(),null);
  let pedidos=0;
  const com=instance(memory(),{persisted:async()=>false,persist:async()=>{pedidos++;return true;},estimate:async()=>({usage:10,quota:100})}).S;
  assert.deepEqual(await flat(await com.persist()),{supported:true,persisted:true});
  assert.equal(pedidos,1);
  const ja=instance(memory(),{persisted:async()=>true,persist:async()=>{throw Error('não deveria ser chamado');}}).S;
  assert.deepEqual(await flat(await ja.persist()),{supported:true,persisted:true});
  const quebrado=instance(memory(),{persisted:async()=>{throw Error('bloqueado');},persist:async()=>true}).S;
  assert.deepEqual(await flat(await quebrado.persist()),{supported:false,persisted:false});
 });

 console.log(`\n${checks} testes de despejo de armazenamento e recuperação concluídos.`);
})().catch(err=>{console.error(err);process.exit(1);});
