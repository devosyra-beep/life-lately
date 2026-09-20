const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{innerHTML:'',hidden:false,classList:{add(){},remove(){}},focus(){}});return nodes.get(id);};
let checkoutCalls=0,statusCalls=0,unlocked=0,entitlement=null,modalHtml='';
const session={user:{id:'test',email:'ana@example.test'}};
const context=vm.createContext({URL,console,Date,setTimeout:fn=>{fn();return 1;},clearTimeout(){},navigator:{onLine:true},
 location:{href:'https://example.test/app/'},history:{replaceState(_a,_b,url){context.location.href=String(url);}},
 document:{getElementById:node,addEventListener(){}},window:{addEventListener(){}},
 LL:{today:()=> '2026-09-20'},LLStore:{},
 LLCloud:{entitlement:async()=>entitlement,checkout:async()=>{checkoutCalls++;return{};},billingStatus:async()=>{statusCalls++;return{orders:[]};},createStore:()=>({load:async()=>({})}),session:()=>session},
 sessionStorage:{setItem(){},getItem(){return null;},removeItem(){}},
});
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../app.js'),'utf8'),context);
context.recordUnlock=()=>{unlocked++;};context.recordModal=html=>{modalHtml=html;};
vm.runInContext('showUnlocked=async()=>recordUnlock();modal=(_title,html)=>recordModal(html);',context);
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
})().catch(error=>{console.error(error);process.exit(1);});
