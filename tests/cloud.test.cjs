const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../cloud.js'),'utf8');
let created=null,oauthCall=null,checks=0;
const client={
 auth:{
  getSession:async()=>({data:{session:null},error:null}),
  onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),
  signInWithOAuth:async options=>{oauthCall=options;return {data:{provider:'google'},error:null};},
  signOut:async()=>({error:null})
 },
 from(){throw Error('Database should not be called by this smoke test.');},
 rpc(){throw Error('RPC should not be called by this smoke test.');}
};
const context=vm.createContext({
 console,
 URL,
 location:{href:'https://devosyra-beep.github.io/life-lately/app/',origin:'https://devosyra-beep.github.io'},
 navigator:{onLine:true},
 supabase:{createClient:(url,key,options)=>{created={url,key,options};return client;}},
 crypto:require('node:crypto').webcrypto,
 TextEncoder,TextDecoder,Uint8Array,atob,btoa,indexedDB:{},
 LL:{clone:structuredClone,normalize:x=>x,validate(){},empty:()=>({version:12,profile:{name:''}})},
 structuredClone,setTimeout,clearTimeout
});
vm.runInContext(source,context);
function ok(name){checks++;console.log('✓',name);}
(async()=>{
 const initialized=await context.LLCloud.init();
 assert.equal(initialized.available,true);assert.equal(initialized.session,null);
 assert.equal(created.url,'https://kgyztrybhrmsxzwpjntq.supabase.co');
 assert.match(created.key,/^sb_publishable_/);assert.equal(created.options.auth.flowType,'pkce');
 assert.equal(created.options.auth.storageKey,'life-lately-cloud-session-v1');
 ok('Cliente usa projeto exclusivo, publishable key, sessão própria e PKCE');
 const settings=context.LLCloud.settings();
 assert.equal(settings.googleEnabled,true);assert.equal(settings.projectRef,'kgyztrybhrmsxzwpjntq');
 await context.LLCloud.signInGoogle();
 assert.equal(oauthCall.provider,'google');
 assert.equal(oauthCall.options.redirectTo,'https://devosyra-beep.github.io/life-lately/app/');
 assert.equal(oauthCall.options.queryParams.prompt,'select_account');
 ok('Google usa o OAuth dedicado e retorna para a rota publicada do app');
 assert.equal(context.LLCloud.displayName({email:'ana@example.com',user_metadata:{}}),'ana');
 assert.equal(context.LLCloud.displayName({email:'x@example.com',user_metadata:{full_name:'Ana Silva'}}),'Ana Silva');
 assert.throws(()=>context.LLCloud.createStore(null),/Sessão Google inválida/);
 ok('Nome do perfil e sessão inválida têm fallback seguro');
 assert(!/service_role/i.test(source));
 ok('Nenhuma chave privilegiada existe no cliente público');
 console.log(`\n${checks} verificações do cliente Supabase concluídas.`);
})().catch(error=>{console.error(error);process.exit(1);});
