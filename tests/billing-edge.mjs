import {createRequire} from 'node:module';
const require=createRequire(process.env.LL_QA_PACKAGE||new URL('../package.json',import.meta.url));
const ts=require('typescript');
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto,createHmac} from 'node:crypto';
const root=new URL('../supabase/functions/',import.meta.url);
let rpcCalls=[],providerCalls=[],user={id:'qa-user'},prepared={id:1,externalId:'ll_qa',devMode:false},refund={send:true,checkoutId:'bill_qa'},active=false;
const env={SUPABASE_URL:'https://test.supabase.co',SUPABASE_ANON_KEY:'test',SUPABASE_SERVICE_ROLE_KEY:'test',ABACATEPAY_API_KEY:'test',ABACATEPAY_PRODUCT_ID:'prod_qa',ABACATEPAY_MODE:'production',ABACATEPAY_WEBHOOK_SECRET:'qa-secret'};
let providerBody={success:true,data:{id:'bill_qa',externalId:'ll_qa',amount:2990,paidAmount:2990,devMode:false,url:'https://app.abacatepay.com/pay/bill_qa',status:'PAID',refundPublicId:'refund_qa'}};
const client={auth:{getUser:async()=>({data:{user},error:user?null:{}})},from(){const chain={select(){return chain},eq(){return chain},maybeSingle:async()=>({data:active?{status:'active'}:null})};return chain;},rpc:async(name,args)=>{rpcCalls.push({name,args});const data=({billing_prepare_checkout:prepared,billing_store_checkout:{status:'checkout_created',checkoutUrl:'https://app.abacatepay.com/pay/bill_qa'},billing_customer_portal:{orders:[]},billing_request_refund:refund,billing_process_payment_event:{processed:true}})[name]??null;return{data,error:null};}};
function handler(name){let fn;const original=readFileSync(new URL(`${name}/index.ts`,root),'utf8');const input=original.replace(/^import .*;\r?\n/gm,'');const result=ts.transpileModule(input,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None},reportDiagnostics:true});assert.equal(result.diagnostics.length,0);vm.runInNewContext(result.outputText,{Deno:{env:{get:k=>env[k]},serve:h=>{fn=h;}},createClient:()=>client,URL,Request,Response,Headers,AbortController,AbortSignal,TextEncoder,Uint8Array,crypto:webcrypto,btoa,setTimeout,clearTimeout,console,fetch:async(url,options)=>{providerCalls.push({url,options});return new Response(JSON.stringify(providerBody),{status:200,headers:{'content-type':'application/json'}});}});return{fn,original};}
const checkout=handler('create-abacatepay-checkout').fn,portal=handler('billing-portal').fn,{fn:webhook,original}=handler('abacatepay-webhook');
function request(body={},headers={},url='https://test.invalid'){return new Request(url,{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body)});}
const auth={authorization:'Bearer qa-token',origin:'https://devosyra-beep.github.io'};let checks=0;function ok(t){checks++;console.log('HARNESS PASS',t);}
assert.equal((await checkout(request())).status,401);assert.equal((await portal(request())).status,401);assert.equal((await webhook(request())).status,401);ok('all handlers reject unauthenticated requests');
assert.equal((await checkout(request({}, {...auth,origin:'https://attacker.invalid'}))).status,403);ok('unexpected browser origins rejected');
user=null;assert.equal((await checkout(request({},auth))).status,401);assert.equal((await portal(request({action:'refund',orderId:1},auth))).status,401);user={id:'qa-user'};ok('fake/expired user session rejected');
env.ABACATEPAY_MODE='sandbox';assert.equal((await checkout(request({},auth))).status,503);env.ABACATEPAY_MODE='production';ok('public customers cannot enter sandbox');
prepared={id:1,busy:true};assert.equal((await checkout(request({},auth))).status,409);prepared={id:1,externalId:'ll_qa',devMode:false};ok('in-flight checkout protected by lease');
active=true;assert.equal((await (await checkout(request({},auth))).json()).status,'already_active');active=false;ok('existing active customer is never charged again');
assert.equal((await checkout(request({},auth))).status,200);ok('validated provider checkout accepted');
providerBody.data.amount=1;assert.equal((await checkout(request({},auth))).status,502);providerBody.data.amount=2990;ok('provider price mismatch rejected');
assert.equal((await portal(request({action:'refund',orderId:'1'},auth))).status,400);ok('refund rejects malformed order identity');
rpcCalls=[];providerCalls=[];await portal(request({action:'refund',orderId:1,reason:'optional reason'},auth));assert(providerCalls.some(c=>c.url.endsWith('/checkouts/refund')));assert(rpcCalls.some(c=>c.name==='billing_record_refund_result'&&c.args.p_refund_id==='refund_qa'));ok('eligible refund submitted and receipt persisted');
refund={send:false,status:'manual_review'};providerCalls=[];await portal(request({action:'refund',orderId:1},auth));assert.equal(providerCalls.length,0);ok('manual/duplicate refund never calls provider again');
const publicHmac=original.match(/"(t9dXRh[^\"]+)"/)[1];
const event={id:'evt_1',event:'checkout.completed',apiVersion:2,devMode:false,data:{checkout:providerBody.data}};
const signed=e=>request(e,{'x-webhook-signature':createHmac('sha256',publicHmac).update(JSON.stringify(e)).digest('base64')},'https://test.invalid?webhookSecret=qa-secret');
assert.equal((await webhook(request(event,{},'https://test.invalid?webhookSecret=qa-secret'))).status,401);ok('webhook requires signature as well as secret');
assert.equal((await webhook(signed({...event,devMode:true}))).status,400);assert.equal((await webhook(signed(event))).status,200);ok('signed live event accepted; sandbox event rejected in production');
console.log(`${checks} Edge HTTP HARNESS scenarios passed`);
