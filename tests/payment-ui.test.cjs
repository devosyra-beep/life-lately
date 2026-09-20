const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{innerHTML:'',hidden:false,classList:{add(){},remove(){}},focus(){}});return nodes.get(id);};
let checkoutCalls=0,statusCalls=0,unlocked=0,entitlement=null,modalHtml='',oauthCalls=0,closed=0;
const session={user:{id:'test',email:'ana@example.test'}};
let currentSession=session,oauthError=null,oauthWait=null;
const context=vm.createContext({URL,console,Date,setTimeout:fn=>{fn();return 1;},clearTimeout(){},navigator:{onLine:true},
 location:{href:'https://example.test/app/'},history:{replaceState(_a,_b,url){context.location.href=String(url);}},
 document:{getElementById:node,addEventListener(){}},window:{addEventListener(){}},
 LL:require('../core.js'),LLStore:{},
 LLCloud:{entitlement:async()=>entitlement,checkout:async()=>{checkoutCalls++;return{};},billingStatus:async()=>{statusCalls++;return{orders:[]};},createStore:()=>({load:async()=>({})}),session:()=>currentSession,settings:()=>({googleEnabled:true}),signInGoogle:async()=>{oauthCalls++;if(oauthError)throw oauthError;if(oauthWait)await oauthWait;}},
 sessionStorage:{setItem(){},getItem(){return null;},removeItem(){}},
});
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../app.js'),'utf8'),context);
context.recordUnlock=()=>{unlocked++;};context.recordModal=html=>{modalHtml=html;};
context.recordClose=()=>{closed++;};
vm.runInContext('showUnlocked=async()=>recordUnlock();modal=(_title,html)=>recordModal(html);closeModal=()=>recordClose();',context);
(async()=>{
 await context.openCloudSession(session);
 assert.equal(checkoutCalls,0);assert.match(node('access').innerHTML,/R\$ 29,90/);assert.match(node('access').innerHTML,/sem renovação/);
 console.log('✓ Login sem compra mostra resumo, não inicia cobrança');
 await context.openCloudSession(session,{verifyPayment:true});assert.equal(checkoutCalls,0);assert.equal(statusCalls,1);
 console.log('✓ Verificar pagamento consulta status sem criar checkout');
 context.location.href='https://example.test/app/?payment=complete';await context.openCloudSession(session);
 assert.match(node('access').innerHTML,/Ainda não há confirmação/);assert.doesNotMatch(node('access').innerHTML,/pagamento foi recebido/);
 assert.equal(unlocked,0);console.log('✓ Parâmetro de retorno não prova pagamento nem libera acesso');
 entitlement={product_code:'life-lately-lifetime',status:'active',provider:'abacatepay'};
 context.location.href='https://example.test/app/?payment=cancelled';await context.openCloudSession(session);assert.equal(unlocked,1);
 console.log('✓ Voltar do checkout não cancela um pagamento confirmado');
 context.openBillingInfo();assert.match(modalHtml,/7 dias/);assert.match(modalHtml,/análise manual/);
 assert.match(modalHtml,/não significa valor já devolvido/);console.log('✓ Regras de compra e reembolso são explícitas');
 vm.runInContext("state=LL.empty();state.profile.name='Visitante';accessMode='guest';",context);
 const guestState=vm.runInContext('state',context);
 assert.match(context.purchaseBanner(),/Quero meu acesso completo/);
 assert.match(context.renderSettings(),/Comprar agora/);
 context.openGuestInfo();assert.match(modalHtml,/data-action="purchase-offer"/);
 context.openPurchaseOffer();assert.match(modalHtml,/R\$ 29,90/);assert.match(modalHtml,/sem esperar/);assert.match(modalHtml,/não serão transferidos/);
 assert.match(modalHtml,/data-action="close"/);assert.equal(vm.runInContext('state',context),guestState);assert.equal(checkoutCalls,0);
 context.closeModal();assert.equal(vm.runInContext('state',context),guestState);console.log('✓ Compra desde o primeiro acesso; abrir e cancelar preserva a demonstração');
 entitlement=null;await context.continuePurchase();assert.equal(oauthCalls,0);assert.equal(checkoutCalls,0);assert.match(node('access').innerHTML,/Pagar com Pix ou cartão/);
 console.log('✓ Conta já conectada segue para o resumo, sem checkout automático');
 currentSession=null;vm.runInContext("state=LL.empty();accessMode='guest';",context);
 const unsignedGuest=vm.runInContext('state',context);context.openPurchaseOffer();assert.match(modalHtml,/Continuar com Google/);
 await context.continuePurchase();assert.equal(oauthCalls,1);assert.equal(checkoutCalls,0);assert.equal(vm.runInContext('state',context),unsignedGuest);
 console.log('✓ Visitante sem conta usa Google, nunca um checkout anônimo');
 context.navigator.onLine=false;await assert.rejects(context.continuePurchase(),/internet/);assert.equal(oauthCalls,1);context.navigator.onLine=true;
 oauthError=Error('Google indisponível');await assert.rejects(context.continuePurchase(),/Google indisponível/);oauthError=null;
 assert.equal(vm.runInContext('busy',context),false);assert.equal(vm.runInContext('state',context),unsignedGuest);
 console.log('✓ Offline e falha do Google preservam os dados temporários');
 let finishOAuth;oauthWait=new Promise(resolve=>{finishOAuth=resolve;});const first=context.continuePurchase();await context.continuePurchase();assert.equal(oauthCalls,3);finishOAuth();await first;oauthWait=null;
 console.log('✓ Cliques repetidos durante o login não iniciam fluxos duplicados');
 for(const provider of ['founder','abacatepay']){
  currentSession=session;entitlement={product_code:'life-lately-lifetime',status:'active',provider};await context.openCloudSession(session);
  vm.runInContext("state=LL.empty();accessMode='cloud';cloudUser={email:'ana@example.test'};",context);
  assert.equal(context.purchaseBanner(),'');context.openPurchaseOffer();assert.match(modalHtml,/Minha compra/);assert.doesNotMatch(modalHtml,/purchase-continue/);assert.equal(checkoutCalls,0);
 }
 console.log('✓ Contas pagas e de cortesia não recebem oferta nem nova cobrança');
})().catch(error=>{console.error(error);process.exit(1);});
