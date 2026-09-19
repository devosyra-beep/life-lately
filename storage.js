/* Edição de primeiro uso, com namespace novo e sem importação automática.
 * O formato criptográfico permanece compatível com restauração explícita de backups.
 * Não alterar estes identificadores nas próximas atualizações desta edição. */
(function(root){
'use strict';
const ACCOUNT_KEY='lifeLatelyZeroV22Account',FALLBACK='lifeLatelyZeroV22State',DB_NAME='life-lately-zero-v22',STORE='app',KEY='state',FORMAT='life-lately-encrypted-v1',ITERATIONS=250000;
let account=null,key=null,revision=null,queue=Promise.resolve(),migrated=false;
const b64=bytes=>{let r='';for(const v of new Uint8Array(bytes))r+=String.fromCharCode(v);return btoa(r);};
const bytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const salt=()=>b64(crypto.getRandomValues(new Uint8Array(16)));
const norm=s=>String(s||'').trim().toLocaleLowerCase('pt-BR');
function requireCrypto(){if(!crypto?.subtle)throw Error('Abra o app pelo endereço HTTPS ou pelo servidor local.');}
function readAccount(){try{const a=JSON.parse(localStorage.getItem(ACCOUNT_KEY)||'null');return a?.authSalt&&a?.dataSalt&&a?.authHash?a:null;}catch{return null;}}
async function base(password){requireCrypto();return crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits','deriveKey']);}
async function hash(password,a){return new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt:bytes(a.authSalt),iterations:a.iterations||ITERATIONS,hash:'SHA-256'},await base(password),256));}
async function derive(password,a){return crypto.subtle.deriveKey({name:'PBKDF2',salt:bytes(a.dataSalt),iterations:a.iterations||ITERATIONS,hash:'SHA-256'},await base(password),{name:'AES-GCM',length:256},false,['encrypt','decrypt']);}
async function verify(password,a){const h=await hash(password,a),expected=bytes(a.authHash);if(h.length!==expected.length)return false;let diff=0;for(let i=0;i<h.length;i++)diff|=h[i]^expected[i];return diff===0;}
async function encrypt(state,k){const iv=crypto.getRandomValues(new Uint8Array(12)),cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},k,new TextEncoder().encode(JSON.stringify(state)));return {format:FORMAT,version:1,iv:b64(iv),data:b64(cipher),savedAt:new Date().toISOString(),revision:LL.uid()};}
async function decrypt(e,k){if(e?.format!==FORMAT)throw Error('Backup inválido.');const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(e.iv)},k,bytes(e.data));return JSON.parse(new TextDecoder().decode(plain));}
function db(){return new Promise((resolve,reject)=>{if(!('indexedDB'in root))return reject(Error('Sem IndexedDB'));const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE);};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('Feche a outra aba do app e tente novamente.'));});}
async function idbRead(){const d=await db();try{return await new Promise((resolve,reject)=>{const r=d.transaction(STORE,'readonly').objectStore(STORE).get(KEY);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}finally{d.close();}}
async function idbWrite(value){const d=await db();try{await new Promise((resolve,reject)=>{const t=d.transaction(STORE,'readwrite');t.objectStore(STORE).put(value,KEY);t.oncomplete=()=>resolve();t.onabort=t.onerror=()=>reject(t.error||Error('Falha ao salvar.'));});}finally{d.close();}}
async function read(){const values=[];try{const v=await idbRead();if(v)values.push(v);}catch{}try{const v=JSON.parse(localStorage.getItem(FALLBACK)||'null');if(v)values.push(v);}catch{}return values.sort((a,b)=>String(b.savedAt||'').localeCompare(String(a.savedAt||'')))[0]||null;}
const token=e=>e?.revision||e?.data||null;
async function write(e){const results=await Promise.allSettled([idbWrite(e),Promise.resolve().then(()=>localStorage.setItem(FALLBACK,JSON.stringify(e)))]);if(results.every(r=>r.status==='rejected'))throw Error('Não foi possível salvar neste navegador. Libere espaço ou exporte um backup.');}
async function atomic(fn){return navigator.locks?navigator.locks.request(DB_NAME+'-write',fn):fn();}
// Um cadastro só passa a existir depois de uma gravação bem-sucedida (ver create()).
// Logo, cadastro sem carga salva significa despejo de armazenamento, nunca primeiro uso.
// Abrir um estado vazio aqui apagaria a chance de restaurar um backup: recusamos.
function orphanError(){const e=Error('Seu cadastro está neste aparelho, mas os dados salvos não foram encontrados. Restaure um backup para recuperá-los.');e.code='no-data';return e;}
async function unlock(password){
 account=readAccount();if(!account)throw Error('Crie seu acesso primeiro.');
 if(!await verify(password,account))throw Error('A senha não confere. Tente novamente.');
 const k=await derive(password,account);
 const e=await read();
 if(!e)throw orphanError();
 let raw;
 try{raw=e.format===FORMAT?await decrypt(e,k):typeof e==='string'?JSON.parse(e):e;}
 catch{throw Error('Não foi possível abrir os dados. Não apague o navegador; tente restaurar um backup.');}
 const state=LL.normalize(raw);LL.validate(state);
 key=k;revision=token(e);
 // Regravação no desbloqueio só se a normalização realmente mudou o esquema.
 migrated=Number(raw?.version)!==Number(state.version)||!!state.migrationNotes?.length;
 return state;
}
// Saída explícita para o cadastro órfão: remove a chave de acesso somente quando não há
// nenhuma carga salva para perder, e somente com a senha correta.
async function discardOrphanAccount(password){
 const a=readAccount();if(!a)throw Error('Não há cadastro neste aparelho.');
 if(!await verify(password,a))throw Error('A senha não confere. Tente novamente.');
 await atomic(async()=>{if(await read())throw Error('Há dados salvos neste aparelho. Entre normalmente em vez de recomeçar.');localStorage.removeItem(ACCOUNT_KEY);});
 account=null;key=null;revision=null;
}
async function create(name,password){requireCrypto();name=String(name).trim();if(name.length<2)throw Error('Como você quer ser chamada?');if(password.length<8)throw Error('Use pelo menos 8 caracteres na senha.');if(readAccount())throw Error('Já existe um acesso neste navegador.');const a={version:1,username:name.slice(0,40),usernameNorm:norm(name),authSalt:salt(),dataSalt:salt(),createdAt:new Date().toISOString(),iterations:ITERATIONS};a.authHash=b64(await hash(password,a));const k=await derive(password,a),state=LL.empty();state.profile.name=a.username;const e=await encrypt(state,k);
 await atomic(async()=>{if(readAccount())throw Error('Já existe um acesso neste navegador.');if(await read())throw Error('Há dados anteriores sem o cadastro. Restaure o backup em vez de sobrescrever.');localStorage.setItem(ACCOUNT_KEY,JSON.stringify(a));try{await write(e);}catch(err){localStorage.removeItem(ACCOUNT_KEY);throw err;}});account=a;key=k;revision=token(e);migrated=false;return state;
}
function save(state){const snapshot=LL.clone(state),k=key;LL.validate(snapshot);const task=queue.catch(()=>{}).then(async()=>{if(!k)throw Error('Desbloqueie o app para salvar.');return atomic(async()=>{const current=await read();if(token(current)!==revision)throw Error('Os dados mudaram em outra aba. Feche e reabra o app antes de continuar.');const e=await encrypt(snapshot,k);await write(e);revision=token(e);
 const currentAccount=readAccount(),displayName=String(snapshot.profile?.name||'').trim().slice(0,40);
 if(currentAccount&&displayName&&currentAccount.username!==displayName){try{const updated={...currentAccount,username:displayName,usernameNorm:norm(displayName)};localStorage.setItem(ACCOUNT_KEY,JSON.stringify(updated));account=updated;}catch{/* The encrypted profile was saved; keep the previous lock-screen label if metadata storage is unavailable. */}}
 return e;});});queue=task;return task;}
async function lock(){await queue.catch(()=>{});key=null;revision=null;}
async function backup(state){await save(state);return {app:'Life Lately',format:'encrypted-backup-v2',exportedAt:new Date().toISOString(),account:readAccount(),payload:await read()};}
async function inspectBackup(text,password){let json;try{json=JSON.parse(text);}catch{throw Error('O arquivo não é um backup válido.');}if(json.app!=='Life Lately'||!['encrypted-backup-v1','encrypted-backup-v2'].includes(json.format))throw Error('Escolha um backup criptografado do Life Lately.');
 const a=json.account||readAccount();if(!a)throw Error('Esse backup antigo não inclui a chave de cadastro. Exporte um novo no aparelho original.');if(!await verify(password,a))throw Error('A senha desse backup não confere.');const k=await derive(password,a);let raw;try{raw=await decrypt(json.payload,k);}catch{throw Error('O backup não abre com este cadastro. Os backups antigos só abrem na instalação original.');}if(!Array.isArray(raw.transactions)||!Array.isArray(raw.allocationCategories))throw Error('O arquivo não contém os dados esperados.');const state=LL.normalize(raw);LL.validate(state);return {state,account:a,key:k};
}
async function restore(prepared){await queue.catch(()=>{});const e=await encrypt(prepared.state,prepared.key),old=readAccount();await atomic(async()=>{localStorage.setItem(ACCOUNT_KEY,JSON.stringify(prepared.account));try{await write(e);}catch(err){if(old)localStorage.setItem(ACCOUNT_KEY,JSON.stringify(old));else localStorage.removeItem(ACCOUNT_KEY);throw err;}});account=prepared.account;key=prepared.key;revision=token(e);return prepared.state;}

// A exclusão é explícita, autenticada e restrita ao namespace desta edição.
// Não usa localStorage.clear() nem apaga outros aplicativos ou instalações anteriores.
async function idbRemove(){
 if(!('indexedDB' in root))return;
 const d=await db();
 try{await new Promise((resolve,reject)=>{const t=d.transaction(STORE,'readwrite');t.objectStore(STORE).delete(KEY);t.oncomplete=()=>resolve();t.onabort=t.onerror=()=>reject(t.error||Error('Não foi possível apagar os dados.'));});}finally{d.close();}
}
function erase(){
 const task=queue.catch(()=>{}).then(async()=>{
  if(!key)throw Error('Desbloqueie o app antes de apagar seu acesso.');
  return atomic(async()=>{
   const current=await read(),previousAccount=readAccount();
   if(token(current)!==revision)throw Error('Os dados mudaram em outra aba. Feche e reabra o app antes de apagar.');
   try{
    await idbRemove();
    localStorage.removeItem(FALLBACK);
    localStorage.removeItem(ACCOUNT_KEY);
   }catch(err){
    // Evita deixar um cadastro órfão caso um dos armazenamentos recuse a operação.
    if(current)await write(current).catch(()=>{});
    if(previousAccount){try{localStorage.setItem(ACCOUNT_KEY,JSON.stringify(previousAccount));}catch{}}
    throw Error('Não foi possível concluir a limpeza. Feche outras abas, permita o armazenamento e tente novamente.');
   }
   account=null;key=null;revision=null;
  });
 });
 queue=task;return task;
}

// Sem armazenamento persistente o navegador pode despejar o IndexedDB sem aviso algum.
// Como este app não guarda nada em servidor, esse despejo é perda definitiva de dados.
// O pedido é idêmpotente e silencioso: nunca interrompe o fluxo de quem está usando.
async function persist(){
 try{
  if(!navigator.storage?.persist)return {supported:false,persisted:false};
  if(await navigator.storage.persisted?.())return {supported:true,persisted:true};
  return {supported:true,persisted:await navigator.storage.persist()};
 }catch{return {supported:false,persisted:false};}
}
async function estimate(){try{const e=await navigator.storage?.estimate?.();return e?{usage:e.usage||0,quota:e.quota||0}:null;}catch{return null;}}

root.LLStore={readAccount,unlock,create,save,lock,backup,inspectBackup,restore,erase,persist,estimate,discardOrphanAccount,hasStoredData:async()=>!!await read(),wasMigrated:()=>migrated,isUnlocked:()=>!!key,keys:{DB_NAME,ACCOUNT_KEY,FALLBACK}};
})(globalThis);
