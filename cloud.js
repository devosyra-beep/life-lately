/* Life Lately cloud access.
 * Supabase project: life-lately (organization LIFE LATELY, sa-east-1).
 * Only the publishable key is present in this public client. Never add secret or
 * service-role keys here.
 */
(function(root){
'use strict';

const CONFIG=Object.freeze({
 url:'https://kgyztrybhrmsxzwpjntq.supabase.co',
 publishableKey:'sb_publishable_kyMQ8y698ISDPR2Q3o1wRA_TH8bAqUG',
 // Turn this on only after the dedicated Google OAuth client is configured.
 googleEnabled:false,
 sessionKey:'life-lately-cloud-session-v1'
});
const DB_NAME='life-lately-cloud-cache-v1',DB_VERSION=1,STATE_STORE='states',KEY_STORE='keys';
let client=null,currentSession=null,authSubscription=null;

function ready(){return !!(root.supabase?.createClient&&CONFIG.url&&CONFIG.publishableKey);}
function canonicalRedirect(){return new URL('./',root.location.href).href.split(/[?#]/)[0];}
function displayName(user){
 const meta=user?.user_metadata||{};
 return String(meta.full_name||meta.name||user?.email?.split('@')[0]||'Você').trim().slice(0,80)||'Você';
}
function requireClient(){if(!client)throw Error('A conexão segura ainda não foi iniciada. Atualize a página e tente de novo.');return client;}
function openDb(){return new Promise((resolve,reject)=>{
 if(!('indexedDB'in root))return reject(Error('Armazenamento local indisponível.'));
 const request=indexedDB.open(DB_NAME,DB_VERSION);
 request.onupgradeneeded=()=>{
  const db=request.result;
  if(!db.objectStoreNames.contains(STATE_STORE))db.createObjectStore(STATE_STORE);
  if(!db.objectStoreNames.contains(KEY_STORE))db.createObjectStore(KEY_STORE);
 };
 request.onsuccess=()=>resolve(request.result);
 request.onerror=()=>reject(request.error||Error('Não foi possível abrir o cache local.'));
 request.onblocked=()=>reject(Error('Feche a outra aba do app e tente novamente.'));
 });}
async function idbGet(storeName,key){const db=await openDb();try{return await new Promise((resolve,reject)=>{const request=db.transaction(storeName,'readonly').objectStore(storeName).get(key);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}finally{db.close();}}
async function idbPut(storeName,key,value){const db=await openDb();try{await new Promise((resolve,reject)=>{const tx=db.transaction(storeName,'readwrite');tx.objectStore(storeName).put(value,key);tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(tx.error||Error('Não foi possível atualizar o cache local.'));});}finally{db.close();}}
async function idbDelete(storeName,key){const db=await openDb();try{await new Promise((resolve,reject)=>{const tx=db.transaction(storeName,'readwrite');tx.objectStore(storeName).delete(key);tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(tx.error||Error('Não foi possível limpar o cache local.'));});}finally{db.close();}}
async function cacheKey(userId){
 let key=await idbGet(KEY_STORE,userId);
 if(key)return key;
 key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
 await idbPut(KEY_STORE,userId,key);
 return key;
}
function b64(bytes){let text='';for(const byte of new Uint8Array(bytes))text+=String.fromCharCode(byte);return btoa(text);}
function bytes(text){return Uint8Array.from(atob(text),c=>c.charCodeAt(0));}
async function writeCache(userId,state,{revision=0,baseRevision=revision,pending=false}={}){
 const key=await cacheKey(userId),iv=crypto.getRandomValues(new Uint8Array(12));
 const payload=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(JSON.stringify(state)));
 await idbPut(STATE_STORE,userId,{version:1,iv:b64(iv),payload:b64(payload),revision:Number(revision)||0,baseRevision:Number(baseRevision)||0,pending:!!pending,savedAt:new Date().toISOString()});
}
async function readCache(userId){
 const envelope=await idbGet(STATE_STORE,userId);if(!envelope)return null;
 try{
  const key=await cacheKey(userId),plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(envelope.iv)},key,bytes(envelope.payload));
  const state=LL.normalize(JSON.parse(new TextDecoder().decode(plain)));LL.validate(state);
  return {...envelope,state};
 }catch{return null;}
}
async function clearCache(userId){await Promise.allSettled([idbDelete(STATE_STORE,userId),idbDelete(KEY_STORE,userId)]);}
function networkError(error){return navigator.onLine===false||/failed to fetch|network|load failed|fetch/i.test(String(error?.message||error||''));}
function conflictError(){const error=Error('Seus dados mudaram em outro aparelho. Atualize o app antes de continuar para evitar sobrescrever alterações.');error.code='cloud-conflict';return error;}
function normalizedState(raw){const state=LL.normalize(raw);LL.validate(state);return state;}

async function init(){
 if(!ready())return {available:false,session:null};
 if(!client){
  client=root.supabase.createClient(CONFIG.url,CONFIG.publishableKey,{auth:{storageKey:CONFIG.sessionKey,persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce'},global:{headers:{'X-Client-Info':'life-lately-web/1.0.0'}}});
  const result=await client.auth.getSession();
  if(result.error)throw result.error;
  currentSession=result.data.session;
  const listener=client.auth.onAuthStateChange((_event,session)=>{currentSession=session;});
  authSubscription=listener.data.subscription;
 }
 return {available:true,session:currentSession};
}
async function signInGoogle(){
 if(!CONFIG.googleEnabled)throw Error('A entrada com Google está na última etapa de configuração. Use “Apenas conhecer” por enquanto.');
 if(navigator.onLine===false)throw Error('Conecte-se à internet para entrar com Google.');
 const result=await requireClient().auth.signInWithOAuth({provider:'google',options:{redirectTo:canonicalRedirect(),queryParams:{prompt:'select_account'}}});
 if(result.error)throw result.error;
 return result.data;
}
async function ensureProfile(user,name=displayName(user)){
 const now=new Date().toISOString();
 const result=await requireClient().from('profiles').upsert({user_id:user.id,display_name:String(name||displayName(user)).trim().slice(0,80),updated_at:now},{onConflict:'user_id'});
 if(result.error)throw result.error;
}
async function fetchRemote(userId){
 const result=await requireClient().from('app_states').select('state,schema_version,revision,updated_at').eq('user_id',userId).maybeSingle();
 if(result.error)throw result.error;
 return result.data;
}
async function pushRemote(state,expectedRevision){
 const result=await requireClient().rpc('save_app_state',{expected_revision:Number(expectedRevision)||0,new_state:state,new_schema_version:Number(state.version)||1,new_client_updated_at:new Date().toISOString()}).single();
 if(result.error){if(result.error.code==='40001')throw conflictError();throw result.error;}
 return result.data;
}
function createStore(user){
 if(!user?.id)throw Error('Sessão Google inválida. Entre novamente.');
 let revision=0,pending=false,lastSyncedAt=null;
 async function load(){
  const cached=await readCache(user.id).catch(()=>null);
  if(navigator.onLine===false){if(cached){revision=cached.baseRevision;pending=cached.pending;return cached.state;}throw Error('Conecte-se à internet uma vez para abrir sua conta neste aparelho.');}
  let remote;
  try{remote=await fetchRemote(user.id);}catch(error){if(cached&&networkError(error)){revision=cached.baseRevision;pending=cached.pending;return cached.state;}throw error;}
  if(cached?.pending){
   const remoteRevision=Number(remote?.revision)||0;
   if(remoteRevision!==Number(cached.baseRevision))throw conflictError();
   const saved=await pushRemote(cached.state,remoteRevision);
   revision=Number(saved.revision);pending=false;lastSyncedAt=saved.updated_at;
   await writeCache(user.id,cached.state,{revision,baseRevision:revision,pending:false}).catch(()=>{});
   await ensureProfile(user,cached.state.profile?.name).catch(()=>{});
   return cached.state;
  }
  if(remote){
   const state=normalizedState(remote.state);revision=Number(remote.revision);pending=false;lastSyncedAt=remote.updated_at;
   await writeCache(user.id,state,{revision,baseRevision:revision,pending:false}).catch(()=>{});
   return state;
  }
  const state=LL.empty();state.profile.name=displayName(user);
  const saved=await pushRemote(state,0);revision=Number(saved.revision);pending=false;lastSyncedAt=saved.updated_at;
  await Promise.allSettled([writeCache(user.id,state,{revision,baseRevision:revision,pending:false}),ensureProfile(user,state.profile.name)]);
  return state;
 }
 async function save(raw){
  const state=LL.clone(raw);LL.validate(state);
  const cached=await readCache(user.id).catch(()=>null);
  const baseRevision=cached?.pending?Number(cached.baseRevision):revision;
  if(navigator.onLine!==false){
   try{
    const saved=await pushRemote(state,baseRevision);
    revision=Number(saved.revision);pending=false;lastSyncedAt=saved.updated_at;
    await Promise.allSettled([writeCache(user.id,state,{revision,baseRevision:revision,pending:false}),ensureProfile(user,state.profile?.name)]);
    return saved;
   }catch(error){if(error?.code==='cloud-conflict'||!networkError(error))throw error;}
  }
  pending=true;
  await writeCache(user.id,state,{revision:baseRevision,baseRevision,pending:true});
  return {revision:baseRevision,pending:true};
 }
 async function sync(raw){
  const cached=await readCache(user.id).catch(()=>null);
  if(!cached?.pending)return {state:raw,changed:false};
  if(navigator.onLine===false)throw Error('Conecte-se à internet para sincronizar.');
  const remote=await fetchRemote(user.id),remoteRevision=Number(remote?.revision)||0;
  if(remoteRevision!==Number(cached.baseRevision))throw conflictError();
  const saved=await pushRemote(cached.state,remoteRevision);
  revision=Number(saved.revision);pending=false;lastSyncedAt=saved.updated_at;
  await writeCache(user.id,cached.state,{revision,baseRevision:revision,pending:false}).catch(()=>{});
  return {state:cached.state,changed:true};
 }
 return {mode:'cloud',user,load,save,sync,lock:async()=>{},persist:async()=>({supported:true,persisted:true}),status:()=>({revision,pending,lastSyncedAt})};
}
async function signOut(userId){
 const c=requireClient();
 const result=await c.auth.signOut({scope:'local'});
 if(result.error)throw result.error;
 currentSession=null;
 if(userId)await clearCache(userId);
}
function session(){return currentSession;}
function settings(){return {available:ready(),googleEnabled:CONFIG.googleEnabled,projectRef:'kgyztrybhrmsxzwpjntq'};}

root.LLCloud={init,session,settings,signInGoogle,signOut,createStore,ensureProfile,displayName,clearCache};
})(globalThis);
