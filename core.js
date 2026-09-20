/* Life Lately — núcleo financeiro. Sem DOM, rede ou armazenamento.
 * Valores públicos em unidades monetárias; rateios e invariantes em centavos.
 */
(function(root){
'use strict';
const CURRENCIES={BRL:['Real brasileiro','R$'],USD:['Dólar americano','US$'],EUR:['Euro','€'],GBP:['Libra esterlina','£'],CNY:['Yuan chinês','CN¥'],ARS:['Peso argentino','AR$'],MXN:['Peso mexicano','MX$'],CLP:['Peso chileno','CL$'],COP:['Peso colombiano','CO$'],JPY:['Iene japonês','JP¥'],CHF:['Franco suíço','CHF'],CAD:['Dólar canadense','C$']};
const clone=x=>structuredClone(x);
const num=x=>Number.isFinite(Number(x))?Number(x):0;
const cents=x=>Math.round((num(x)+Math.sign(num(x))*Number.EPSILON)*100);
const money=x=>cents(x)/100;
const positive=x=>Math.max(0,money(x));
const uid=()=>globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2,12)}`;
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
function validDate(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const [y,m,d]=v.split('-').map(Number),dt=new Date(Date.UTC(y,m-1,d));return y>=1900&&dt.getUTCFullYear()===y&&dt.getUTCMonth()===m-1&&dt.getUTCDate()===d;}
function daysTo(v,at=today()){return validDate(v)?Math.round((Date.parse(v+'T12:00:00Z')-Date.parse(at+'T12:00:00Z'))/86400000):null;}
function afterMonths(n,at=today()){const [y,m,d]=at.split('-').map(Number),dt=new Date(y,m-1+Number(n),1,12);dt.setDate(Math.min(d,new Date(dt.getFullYear(),dt.getMonth()+1,0).getDate()));return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;}
function parseMoney(raw){
 if(typeof raw==='number'){if(!Number.isFinite(raw))throw Error('Informe um valor válido.');return money(raw);}
 let s=String(raw??'').trim();if(!s)return 0;
 s=s.replace(/(?:R\$|US\$|AR\$|MX\$|CL\$|CO\$|C\$|CN¥|JP¥|CHF|BRL|USD|EUR|GBP|CNY|JPY|\$|€|£|¥)/gi,'').replace(/\s|\u00a0/g,'');
 if(!/^-?[\d.,]+$/.test(s))throw Error('Digite só o valor, por exemplo 10,50.');
 const neg=s[0]==='-';s=s.replace(/^-/,'');
 let at=-1;const comma=s.lastIndexOf(','),dot=s.lastIndexOf('.');
 if(comma>=0&&dot>=0)at=Math.max(comma,dot);
 else {const i=Math.max(comma,dot);if(i>=0){const tail=s.length-i-1;if(tail<=2)at=i;else if(tail!==3)throw Error('Use no máximo dois centavos: 10,50.');}}
 let v=at>=0? s.slice(0,at).replace(/[.,]/g,'')+'.'+s.slice(at+1).replace(/[.,]/g,''):s.replace(/[.,]/g,'');
 if(at>=0&&s.slice(at+1).length>2)throw Error('Use no máximo duas casas decimais.');
 const n=Number(v||0)*(neg?-1:1);if(!Number.isFinite(n)||Math.abs(n)>999999999999)throw Error('Esse valor é muito alto.');return money(n);
}
function fmt(s,value,compact=false){const cur=s.preferences?.currency||'BRL';return `${(CURRENCIES[cur]||CURRENCIES.BRL)[1]} ${num(value).toLocaleString('pt-BR',{minimumFractionDigits:compact&&cents(value)%100===0?0:2,maximumFractionDigits:2})}`;}
const free=()=>({id:'livre',label:'Livre',icon:'✨',color:'#72a38b',role:'free',goalId:'',debtId:'',targetAmount:0,targetDate:'',movements:[],archived:false});
function empty(){return {version:12,planning:{month:today().slice(0,7),closures:[],resets:[],undo:null},profile:{name:''},preferences:{currency:'BRL',allocationMode:'auto'},goals:{monthly:0,weekly:0,financial:{id:'financial-main',name:'',target:0,targetDate:'',initialSaved:0,movements:[]}},allocationCategories:[free()],allocation:{livre:100},transactions:[],debts:[],activity:[],migrationNotes:[]};}
function movements(list,types){return Array.isArray(list)?list.filter(x=>x&&typeof x==='object').map(x=>({...x,id:String(x.id||uid()),type:types.includes(x.type)?x.type:'adjustment',amount:money(x.amount),date:validDate(x.date)?x.date:today(),note:String(x.note||'').slice(0,200)})).filter(x=>x.amount!==0):[];}
function normalize(raw){
 if(!raw||typeof raw!=='object')throw Error('Os dados do app não puderam ser lidos. Restaure um backup.');
 const s={...empty(),...clone(raw),version:12};s.profile={...raw.profile,name:String(raw.profile?.name||'').slice(0,40)};
 s.preferences={...raw.preferences,currency:CURRENCIES[raw.preferences?.currency]?raw.preferences.currency:'BRL',allocationMode:raw.preferences?.allocationMode==='manual'?'manual':'auto'};
 s.goals={...empty().goals,...raw.goals,monthly:positive(raw.goals?.monthly),weekly:positive(raw.goals?.weekly)};
 s.goals.financial={...empty().goals.financial,...raw.goals?.financial};
 s.migrationNotes=Array.isArray(raw.migrationNotes)?raw.migrationNotes:[];
 const used=new Set();
 s.allocationCategories=(Array.isArray(raw.allocationCategories)?raw.allocationCategories:[]).filter(c=>c&&typeof c==='object').map((c,i)=>{
  let id=String(c.id||`category-${i}`).replace(/[^\w-]/g,'-').slice(0,100);while(used.has(id))id+='x';used.add(id);
  return {...c,id,label:String(c.label||'Cofrinho').slice(0,60),icon:String(c.icon||'🐷').slice(0,12),color:/^#[a-f\d]{6}$/i.test(c.color)?c.color:'#d5839b',role:['free','custom','goal','debt'].includes(c.role)?c.role:'custom',goalId:String(c.goalId||''),debtId:String(c.debtId||''),targetAmount:positive(c.targetAmount),targetDate:validDate(c.targetDate)?c.targetDate:'',planningPaused:!!c.planningPaused,recurrence:c.recurrence==='monthly'?'monthly':'once',recurrenceDay:Math.max(1,Math.min(31,Number(c.recurrenceDay)||Number((c.targetDate||'').slice(-2))||1)),archived:!!c.archived,movements:movements(c.movements,['deposit','spend','adjustment','transfer_in','transfer_out'])};
 });
 s.allocation={};for(const c of s.allocationCategories)s.allocation[c.id]=Math.max(0,Math.min(100,num(raw.allocation?.[c.id])));
 const fg=s.goals.financial;
 if(positive(fg.target)>0){
  let c=s.allocationCategories.find(c=>c.role==='goal'&&(c.goalId||'financial-main')==='financial-main');
  if(!c){c={id:used.has('meta-financeira')?'goal-'+uid():'meta-financeira',label:fg.name||'Minha meta',icon:'🎯',color:'#d5839b',role:'goal',goalId:'financial-main',debtId:'',movements:[],archived:false};s.allocationCategories.push(c);s.allocation[c.id]=0;}
  c.goalId='financial-main';c.targetAmount=positive(fg.target);c.targetDate=validDate(fg.targetDate)?fg.targetDate:'';
  if(positive(fg.initialSaved)>0)c.movements.push({id:'legacy-initial-'+c.id,type:'deposit',amount:positive(fg.initialSaved),date:today(),note:'Saldo inicial anterior'});
  c.movements.push(...movements(fg.movements,['deposit','adjustment']));fg.initialSaved=0;fg.movements=[];
 }
 s.transactions=(Array.isArray(raw.transactions)?raw.transactions:[]).filter(t=>t&&positive(t.value)>0).map(t=>({...t,id:String(t.id||uid()),description:String(t.description||'Ganho').slice(0,70),type:String(t.type||'Outro'),value:positive(t.value),date:validDate(t.date)?t.date:today(),allocationSnapshot:clone(t.allocationSnapshot||{})}));
 // Convert old percentage snapshots once; cents eliminate drift on every screen.
 for(const t of s.transactions){
  const snap=t.allocationSnapshot,keys=Object.keys(snap);
  if(!keys.length)continue;
  if(keys.every(id=>Number.isInteger(snap[id]?.amountCents)&&snap[id].amountCents>=0))continue;
  const entries=keys.map(id=>({id,weight:Math.max(0,num(typeof snap[id]==='object'?snap[id].pct:snap[id]))}));
  const total=entries.reduce((a,e)=>a+e.weight,0);if(!total){t.allocationSnapshot={};continue;}
  const intended=Math.min(cents(t.value),Math.round(cents(t.value)*total/100));
  const shares=apportion(intended,entries);
  if(total>100.005&&!s.migrationNotes.includes('legacy-overallocation'))s.migrationNotes.push('legacy-overallocation');
  t.allocationSnapshot=Object.fromEntries(entries.map(e=>[e.id,{...(typeof snap[e.id]==='object'?snap[e.id]:{}),pct:e.weight,amountCents:shares[e.id]||0}]));
 }
 s.debts=(Array.isArray(raw.debts)?raw.debts:[]).filter(Boolean).map(d=>{
  const m=movements(d.movements,['payment','adjustment']);if(!m.length&&positive(d.paid)>0)m.push({id:uid(),type:'payment',amount:Math.min(positive(d.paid),positive(d.initialTotal??d.total)),date:today(),note:'Pagamento anterior'});
  return {...d,id:String(d.id||uid()),name:String(d.name||'Compromisso').slice(0,60),initialTotal:positive(d.initialTotal??d.total),due:validDate(d.due)?d.due:'',movements:m,archived:!!d.archived};
 });
 const generic=s.allocationCategories.find(c=>c.role==='debt'&&!c.debtId&&!c.archived);
 for(const d of s.debts){
  if(d.archived)continue;
  if(s.allocationCategories.some(c=>c.id===d.pocketId))continue;
  const specific=s.allocationCategories.find(c=>c.debtId===d.id);
  if(specific||generic)d.pocketId=(specific||generic).id;
  else {const c=debtPocket(d);s.allocationCategories.push(c);s.allocation[c.id]=0;d.pocketId=c.id;}
 }
 if(!s.allocationCategories.some(c=>c.role==='free'&&!c.archived)){let c=free();if(used.has(c.id))c.id='free-'+uid();s.allocationCategories.push(c);s.allocation[c.id]=0;}
 for(const c of s.allocationCategories){c.cycleSpentBaselineCents=Number.isInteger(c.cycleSpentBaselineCents)&&c.cycleSpentBaselineCents>=0?c.cycleSpentBaselineCents:legacyCycleBaseline(c);c.planningPaused=!!c.planningPaused;c.recurrence=c.recurrence==='monthly'?'monthly':'once';c.recurrenceDay=Math.max(1,Math.min(31,Number(c.recurrenceDay)||Number((c.targetDate||'').slice(-2))||1));}
 s.activity=Array.isArray(raw.activity)?raw.activity.slice(0,1500):[];
 const plan=raw.planning||{};
 s.planning={month:validMonth(plan.month)?plan.month:today().slice(0,7),closures:Array.isArray(plan.closures)?plan.closures.filter(r=>r&&validMonth(r.month)):[],resets:Array.isArray(plan.resets)?plan.resets.filter(r=>r&&typeof r.id==='string'):[],undo:plan.undo&&['reset','rollover'].includes(plan.undo.kind)&&plan.undo.before&&typeof plan.undo.expected==='string'?plan.undo:null};
 if(Number(raw.version)<12 && s.planning.undo) upgradePlanningUndo(s);
 return s;
}
function cats(s){return s.allocationCategories.filter(c=>!c.archived);}
function cat(s,id){return s.allocationCategories.find(c=>c.id===id);}
function contributionCents(t,id){return Math.max(0,Math.trunc(num(t.allocationSnapshot?.[id]?.amountCents)));}
function allocatedCents(t){return Object.keys(t.allocationSnapshot||{}).reduce((a,id)=>a+contributionCents(t,id),0);}
function pendingCents(s){return s.transactions.reduce((a,t)=>a+Math.max(0,cents(t.value)-allocatedCents(t)),0);}
function pocketCents(s,id){const c=cat(s,id);if(!c)return 0;return s.transactions.reduce((a,t)=>a+contributionCents(t,id),0)+(c.movements||[]).reduce((a,m)=>a+(m.type==='spend'||m.type==='transfer_out'?-cents(m.amount):cents(m.amount)),0);}
function pocket(s,id){return pocketCents(s,id)/100;}
function pocketStats(s,id){const c=cat(s,id);const allocated=s.transactions.reduce((a,t)=>a+contributionCents(t,id),0),m=c?.movements||[];return {balance:pocket(s,id),allocated:allocated/100,added:m.filter(x=>x.type==='deposit').reduce((a,x)=>a+cents(x.amount),0)/100,spent:m.filter(x=>x.type==='spend').reduce((a,x)=>a+cents(x.amount),0)/100,transferred:m.filter(x=>x.type.startsWith('transfer')).reduce((a,x)=>a+(x.type==='transfer_out'?-cents(x.amount):cents(x.amount)),0)/100,adjustments:m.filter(x=>x.type==='adjustment').reduce((a,x)=>a+cents(x.amount),0)/100};}
function debtBalance(s,d){if(typeof d==='string')d=s.debts.find(x=>x.id===d);if(!d)return 0;return Math.max(0,cents(d.initialTotal)+(d.movements||[]).reduce((a,m)=>a+(m.type==='payment'?-cents(m.amount):cents(m.amount)),0))/100;}
function debtPaid(d){return (d.movements||[]).filter(m=>m.type==='payment').reduce((a,m)=>a+cents(m.amount),0)/100;}
function linkedDebts(s,id){return s.debts.filter(d=>!d.archived&&d.pocketId===id);}

// One funding limit for income, manual percentages, pending cash and internal transfers.
// Saved cash is never treated as a payment. Monthly spending fulfills the current cycle.
function spentCents(c){return (c.movements||[]).filter(m=>m.type==='spend').reduce((n,m)=>n+Math.max(0,cents(m.amount)),0);}
function legacyCycleBaseline(c){
 if(c.recurrence!=='monthly')return 0;
 const period=(validDate(c.targetDate)?c.targetDate:today()).slice(0,7);
 return (c.movements||[]).filter(m=>m.type==='spend'&&!m.date?.startsWith(period)).reduce((n,m)=>n+Math.max(0,cents(m.amount)),0);
}
function cycleSpent(s,c){return c.recurrence==='monthly'&&!linkedDebts(s,c.id).length?Math.max(0,spentCents(c)-(c.cycleSpentBaselineCents??legacyCycleBaseline(c)))/100:0;}
function funding(s,c,at=today()){
 const linked=linkedDebts(s,c.id),live=linked.filter(d=>debtBalance(s,d)>0);
 const debtRelated=linked.length>0||(c.role==='debt'&&!!c.debtId);
 const amount=debtRelated?live.reduce((n,d)=>n+cents(debtBalance(s,d)),0)/100:positive(c.targetAmount);
 const date=debtRelated?live.map(d=>d.due).filter(Boolean).sort()[0]||'':c.targetDate||'';
 const saved=pocket(s,c.id),used=cycleSpent(s,c),covered=money(saved+used);
 const bounded=c.role!=='free'&&(amount>0||debtRelated),remaining=bounded?Math.max(0,cents(amount)-cents(covered))/100:0;
 return {amount,date,saved,used,covered,remaining,bounded,done:bounded&&remaining===0,linked,days:daysTo(date,at)};
}
function target(s,c,at=today()){
 const f=funding(s,c,at);
 if(c.planningPaused)return {...f,amount:0,date:'',remaining:0,days:null,done:false,paused:true};
 return f;
}
function primaryFree(s){return cats(s).find(c=>c.role==='free');}
function fundingCapacity(s,c){if(!c||c.archived)return 0;const f=funding(s,c);return f.bounded?cents(f.remaining):Infinity;}
function capShares(s,requested){
 const shares=Object.fromEntries(cats(s).map(c=>[c.id,0])),limited=[];let overflow=0;
 for(const [id,raw] of Object.entries(requested)){
  const n=Math.max(0,Math.trunc(num(raw))),c=cat(s,id),cap=fundingCapacity(s,c),accepted=Math.min(n,cap);
  if(c&&!c.archived)shares[id]=(shares[id]||0)+accepted;
  if(n>accepted){overflow+=n-accepted;limited.push({id,requestedCents:n,acceptedCents:accepted,overflowCents:n-accepted});}
 }
 const freeC=primaryFree(s);if(freeC)shares[freeC.id]=(shares[freeC.id]||0)+overflow;
 return {shares,overflowCents:overflow,limited,pending:freeC?0:overflow};
}
// Legacy shared debt pockets reserve money once, ordered by due date, never once per debt.
function debtFunding(s,debt){
 const d=typeof debt==='string'?s.debts.find(x=>x.id===debt):debt;
 if(!d)return {balance:0,paid:0,reserved:0,remaining:0,ready:false,settled:true,progress:100};
 const balance=debtBalance(s,d),paid=debtPaid(d);
 let pool=Math.max(0,pocketCents(s,d.pocketId)),reserved=0;
 const group=linkedDebts(s,d.pocketId).filter(x=>debtBalance(s,x)>0).sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999')||a.id.localeCompare(b.id));
 for(const item of group){const take=Math.min(pool,cents(debtBalance(s,item)));if(item.id===d.id)reserved=take;pool-=take;}
 const remaining=Math.max(0,cents(balance)-reserved)/100,effective=cents(paid)+cents(balance);
 return {balance,paid,reserved:reserved/100,remaining,ready:balance>0&&remaining===0,settled:balance===0,progress:effective?Math.min(100,(cents(paid)+reserved)/effective*100):100};
}
// Largest remainder apportionment: exact integer cents, deterministic ties.
function apportion(total,entries){
 total=Math.max(0,Math.trunc(total));const out=Object.fromEntries(entries.map(e=>[e.id,0]));
 const positiveEntries=entries.filter(e=>num(e.weight)>0);const weight=positiveEntries.reduce((a,e)=>a+e.weight,0);if(!weight||!total)return out;
 const parts=positiveEntries.map((e,i)=>{const exact=total*e.weight/weight,base=Math.floor(exact);return {...e,i,base,remainder:exact-base};});
 let rest=total-parts.reduce((a,e)=>a+e.base,0);parts.sort((a,b)=>b.remainder-a.remainder||a.i-b.i);
 parts.forEach((p,i)=>{out[p.id]=p.base+(i<rest?1:0);});return out;
}
function rateEntries(s,at=today()){
 return cats(s).map(c=>{const t=target(s,c,at);return {id:c.id,c,t,cap:cents(t.remaining),weight:t.amount>0&&t.remaining>0?cents(t.remaining)/Math.max(1,t.days===null?30:t.days):0};}).filter(e=>e.weight>0);
}

function allocation(s,amount,at=today(),mode=s.preferences.allocationMode){
 const total=Math.max(0,cents(amount)),available=cats(s),out=Object.fromEntries(available.map(c=>[c.id,0]));
 if(!total)return {amountCents:0,shares:out,pending:0,overflowCents:0,limited:[],mode};
 let requested;
 if(mode==='manual'){
  const sum=available.reduce((a,c)=>a+num(s.allocation[c.id]),0);
  if(Math.abs(sum-100)>0.005)return {amountCents:total,shares:out,pending:total,mode,error:'A divisão manual precisa somar 100%.'};
  requested=apportion(total,available.map(c=>({id:c.id,weight:num(s.allocation[c.id])})));
 }else{
  const entries=rateEntries(s,at),freeC=primaryFree(s);
  if(!entries.length){
   const everPlanned=available.some(c=>target(s,c,at).bounded&&!c.planningPaused)||s.preferences.autoConfigured;
   if(!everPlanned)return {amountCents:total,shares:out,pending:total,overflowCents:0,limited:[],mode};
   if(freeC)out[freeC.id]=total;
   return {amountCents:total,shares:out,pending:freeC?0:total,overflowCents:0,limited:[],mode};
  }
  requested=apportion(total,entries);
 }
 // Cap each share once. Any excess goes to Livre, not to a different commitment.
 return {amountCents:total,...capShares(s,requested),mode};
}
function forecast(s,at=today()){
 const entries=rateEntries(s,at),monthly=num(s.goals.monthly)||num(s.goals.weekly)*52/12;
 const daily=entries.reduce((a,e)=>a+e.weight/100,0);
 return {daily,monthly:money(daily*30.4375),expectedMonthly:monthly,shortfall:monthly>0&&daily>monthly/30.4375,late:entries.some(e=>e.t.days!==null&&e.t.days<0),hasTargets:entries.length>0};
}
function attach(s,t,plan){
 for(const [id,amountCents] of Object.entries(plan.shares)){if(!amountCents)continue;const c=cat(s,id),prev=t.allocationSnapshot[id];const combined=contributionCents(t,id)+amountCents;t.allocationSnapshot[id]={...prev,amountCents:combined,pct:combined/cents(t.value)*100,role:c?.role||'custom',label:c?.label||id,goalId:c?.goalId||''};}
 t.distributionVersion=2;
}
function previewPending(s){const draft=clone(s),totals={},rows=[];for(const t of [...draft.transactions].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id))){const pending=Math.max(0,cents(t.value)-allocatedCents(t));if(!pending)continue;const p=allocation(draft,pending/100);if(p.error)throw Error(p.error);attach(draft,t,p);rows.push({id:t.id,plan:p});for(const [id,v]of Object.entries(p.shares))totals[id]=(totals[id]||0)+v;}return {rows,shares:totals,amountCents:Object.values(totals).reduce((a,v)=>a+v,0),remaining:pendingCents(draft)};}
function recordActivity(s,type,id,title,before,after,note='',action='change',date=today()){
 s.activity.unshift({id:uid(),targetType:type,targetId:id,action,title,before:money(before),after:money(after),delta:money(after-before),date,note:String(note).slice(0,200),createdAt:new Date().toISOString()});s.activity=s.activity.slice(0,1500);
}
function applyPending(s){const p=previewPending(s);if(!p.amountCents)throw Error('Defina um valor para juntar ou escolha uma divisão manual.');for(const row of p.rows)attach(s,s.transactions.find(t=>t.id===row.id),row.plan);recordActivity(s,'allocation','main','Dinheiro separado',0,p.amountCents/100,'','apply');return p;}
function income(s,{id='',value,description='',type='Outro',date=today(),distribute=true}){
 value=positive(value);if(value<=0)throw Error('Informe quanto entrou.');if(!validDate(date)||date>today())throw Error('Use a data em que o dinheiro já entrou.');
 const old=s.transactions.find(t=>t.id===id);
 if(old){

  const before=old.value,allocated=allocatedCents(old),frac=before?allocated/cents(before):0;
  let newTotal=Math.min(cents(value),Math.round(cents(value)*frac)),shares;
  if(cents(value)>cents(before)){
   const additions=apportion(Math.max(0,newTotal-allocated),Object.entries(old.allocationSnapshot).map(([id,v])=>({id,weight:num(v.amountCents)})));
   const capped=capShares(s,additions);shares=Object.fromEntries(Object.keys(old.allocationSnapshot).map(id=>[id,contributionCents(old,id)]));
   for(const [id,n] of Object.entries(capped.shares))if(n)shares[id]=(shares[id]||0)+n;
   newTotal=Object.values(shares).reduce((a,n)=>a+n,0);
  }else shares=apportion(newTotal,Object.entries(old.allocationSnapshot).map(([id,v])=>({id,weight:num(v.amountCents)})));
  for(const [key,v] of Object.entries(shares)){
   const afterBalance=pocketCents(s,key)-contributionCents(old,key)+v;
   if(afterBalance<Math.min(0,pocketCents(s,key)))throw Error(`Parte deste ganho já foi usada em ${cat(s,key)?.label||'um cofrinho'}. Ajuste ou reponha o cofrinho antes de reduzir o ganho.`);
  }
  old.value=value;old.description=description.trim()||'Ganho';old.type=type;old.date=date;
  for(const [key,v] of Object.entries(shares)){const c=cat(s,key);old.allocationSnapshot[key]={...old.allocationSnapshot[key],amountCents:v,pct:cents(value)?v/cents(value)*100:0,role:c?.role||'custom',label:c?.label||key};}
  recordActivity(s,'income',id,`Ganho atualizado · ${old.description}`,before,value,'Divisão original preservada; acréscimos respeitam o limite','set',date);return {entry:old,shares,pending:cents(value)-newTotal};
 }
 const p=distribute?allocation(s,value):{shares:{},pending:cents(value)};
 if(p.error)throw Error(p.error);
 const entry={id:uid(),value,description:description.trim()||'Ganho',type,date,allocationSnapshot:{}};attach(s,entry,p);s.transactions.push(entry);
 recordActivity(s,'income',entry.id,entry.description,0,value,'','create',date);return {entry,shares:p.shares,pending:p.pending};
}
function removeIncome(s,id){const t=s.transactions.find(t=>t.id===id);if(!t)return;for(const key of Object.keys(t.allocationSnapshot)){if(pocketCents(s,key)-contributionCents(t,key)<Math.min(0,pocketCents(s,key)))throw Error(`Este ganho já foi usado em ${cat(s,key)?.label||'um cofrinho'}. Reponha ou ajuste esse saldo antes de excluir.`);}s.transactions=s.transactions.filter(t=>t.id!==id);recordActivity(s,'income',id,`Ganho excluído · ${t.description}`,t.value,0,'','delete');}
function upsertPocket(s,{id='',label,icon='🐷',color='#d5839b',role='custom',targetAmount=0,targetDate='',recurrence} ){
 label=String(label||'').trim();if(!label)throw Error('Dê um nome ao cofrinho.');if(targetDate&&!validDate(targetDate))throw Error('Confira a data.');if(targetDate&&positive(targetAmount)<=0)throw Error('Informe o valor que quer juntar.');
 let c=cat(s,id);const before=c?.targetAmount||0,oldDate=c?.targetDate,oldDay=c?.recurrenceDay,oldRepeat=c?.recurrence;
 const repeat=recurrence===undefined?(c?.recurrence||'once'):recurrence;
 if(!['once','monthly'].includes(repeat))throw Error('Escolha uma repetição válida.');
 if(repeat==='monthly'&&(!targetDate||!positive(targetAmount)))throw Error('Para repetir todo mês, informe o valor e o primeiro vencimento.');
 if(c){if(linkedDebts(s,id).length)throw Error('Edite o valor e o prazo no compromisso vinculado.');Object.assign(c,{label:label.slice(0,60),icon,color,role:c.role==='free'?'free':role,targetAmount:positive(targetAmount),targetDate});}
 else {c={id:'pocket-'+uid(),label:label.slice(0,60),icon,color,role,targetAmount:positive(targetAmount),targetDate,movements:[],archived:false,goalId:role==='goal'?'goal-'+uid():''};s.allocationCategories.push(c);s.allocation[c.id]=0;}
 if(c.cycleSpentBaselineCents===undefined)c.cycleSpentBaselineCents=spentCents(c);
 if(repeat==='monthly'&&(oldRepeat!=='monthly'||oldDate?.slice(0,7)!==targetDate.slice(0,7)))c.cycleSpentBaselineCents=spentCents(c);
 c.planningPaused=false;c.recurrence=c.role==='free'?'once':repeat;c.recurrenceDay=repeat==='monthly'&&oldRepeat==='monthly'&&oldDate===targetDate?(oldDay||Number(targetDate?.slice(-2))||1):(Number(targetDate?.slice(-2))||1);
 if(c.goalId==='financial-main'){s.goals.financial.name=label;s.goals.financial.target=c.targetAmount;s.goals.financial.targetDate=targetDate;}
 if(c.targetAmount>0)s.preferences.autoConfigured=true;
 recordActivity(s,'pocket',c.id,`Plano · ${label}`,before,c.targetAmount,targetDate,'configure');return c;
}
function archivePocket(s,id){const c=cat(s,id);if(!c)return;if(c.role==='free')throw Error('O cofrinho Livre recebe o restante da divisão.');if(linkedDebts(s,id).some(d=>debtBalance(s,d)>0))throw Error('Há um compromisso ativo ligado a este cofrinho.');if(pocketCents(s,id)!==0)throw Error('Transfira ou ajuste o saldo antes de arquivar.');c.archived=true;retireAllocation(s,id);if(c.goalId==='financial-main'){s.goals.financial.target=0;s.goals.financial.name='';s.goals.financial.targetDate='';}recordActivity(s,'pocket',id,`Cofrinho arquivado · ${c.label}`,0,0,'Histórico preservado','archive');}
function debtPocket(d){return {id:'debt-'+d.id,label:d.name,icon:'💳',color:'#b591a4',role:'debt',goalId:'',debtId:d.id,targetAmount:0,targetDate:'',movements:[],archived:false};}
function upsertDebt(s,{id='',name,total,due=''}){
 name=String(name||'').trim();total=positive(total);if(!name)throw Error('Dê um nome ao compromisso.');if(due&&!validDate(due))throw Error('Confira o vencimento.');let d=s.debts.find(d=>d.id===id);
 if(d){const before=debtBalance(s,d);d.name=name;d.due=due;if(cents(total)!==cents(before))d.movements.push({id:uid(),type:'adjustment',amount:money(total-before),date:today(),note:'Saldo corrigido'});const c=cat(s,d.pocketId);if(c&&linkedDebts(s,c.id).length===1){c.label=name;c.debtId=d.id;}recordActivity(s,'debt',d.id,`Compromisso atualizado · ${name}`,before,total,'','set_balance');}
 else {if(!total)throw Error('Informe o valor do compromisso.');d={id:uid(),name,initialTotal:total,due,movements:[],archived:false};const c=debtPocket(d);d.pocketId=c.id;s.debts.push(d);s.allocationCategories.push(c);s.allocation[c.id]=0;recordActivity(s,'debt',d.id,`Compromisso · ${name}`,0,total,'','create');}
 const cp=cat(s,d.pocketId);if(cp){cp.planningPaused=false;if(total>0){cp.archived=false;cp.closedForDebt=false;d.settledAt='';}}
 s.preferences.autoConfigured=true;return d;
}

function retireAllocation(s,id){const f=primaryFree(s),n=num(s.allocation[id]);s.allocation[id]=0;if(f&&f.id!==id)s.allocation[f.id]=num(s.allocation[f.id])+n;}
function transferEntries(s,sourceId,shares,{date=today(),note='',reason='transfer',operationId=uid()}={}){
 const from=cat(s,sourceId),total=Object.entries(shares).filter(([id])=>id!==sourceId).reduce((n,[,v])=>n+v,0);
 if(!from||from.archived||total>Math.max(0,pocketCents(s,sourceId)))throw Error('O saldo disponível mudou. Revise os valores.');
 for(const [id,n] of Object.entries(shares)){
  if(!n||id===sourceId)continue;const to=cat(s,id);if(!to||to.archived)throw Error('Destino indisponível.');
 }
 for(const [id,n] of Object.entries(shares)){
  if(!n||id===sourceId)continue;const to=cat(s,id),before=pocket(s,sourceId),destBefore=pocket(s,id),linkId=uid();
  const meta={date,linkId,operationId,planningMonth:planningMonth(s),reason};
  from.movements.push({id:uid(),type:'transfer_out',amount:n/100,note:note||`Para ${to.label}`,...meta});
  to.movements.push({id:uid(),type:'transfer_in',amount:n/100,note:note||`De ${from.label}`,...meta});
  recordActivity(s,'pocket',sourceId,`Transferência para ${to.label}`,before,pocket(s,sourceId),note,'transfer',date);
  recordActivity(s,'pocket',id,`Transferência de ${from.label}`,destBefore,pocket(s,id),note,'transfer',date);
 }
 return total;
}
function finishDebtPocket(s,id,date=today()){
 const c=cat(s,id);if(!c||c.archived||linkedDebts(s,id).some(d=>debtBalance(s,d)>0))return;
 if(!linkedDebts(s,id).length)return;
 const surplus=Math.max(0,pocketCents(s,id)),freeC=primaryFree(s);
 if(surplus&&freeC)transferEntries(s,id,{[freeC.id]:surplus},{date,note:'Sobra do compromisso quitado',reason:'debt_settled'});
 if(pocketCents(s,id)!==0)return; // An old inconsistent balance is never hidden.
 c.closedForDebt=true;c.archived=true;retireAllocation(s,id);
 recordActivity(s,'pocket',id,`Cofrinho concluído · ${c.label}`,0,0,'Compromisso quitado; histórico preservado','archive',date);
}
function fundingSignature(s){return JSON.stringify({month:planningMonth(s),mode:s.preferences.allocationMode,configured:s.preferences.autoConfigured,allocation:s.allocation,categories:s.allocationCategories.map(c=>({id:c.id,archived:!!c.archived,paused:!!c.planningPaused,amount:funding(s,c).amount,date:funding(s,c).date,balance:pocketCents(s,c.id),used:cycleSpent(s,c)})),debts:s.debts.map(d=>({id:d.id,pocketId:d.pocketId,archived:d.archived,balance:debtBalance(s,d),due:d.due}))});}
function settlementPreview(s,id,sourceId){
 const d=s.debts.find(d=>d.id===id&&!d.archived);if(!d)throw Error('Compromisso não encontrado.');
 const f=debtFunding(s,d),source=sourceId===undefined?d.pocketId:sourceId,c=cat(s,source);
 if(source&&(!c||c.archived)&&f.balance>0)throw Error('Cofrinho de origem indisponível.');
 const available=source===d.pocketId?cents(f.reserved):Math.max(0,pocketCents(s,source)),funded=Math.min(cents(f.balance),available);
 return {...f,sourceId:source,amountCents:cents(f.balance),fundedCents:funded,externalCents:cents(f.balance)-funded,signature:fundingSignature(s)};
}
function settleDebt(s,id,{date=today(),note='',sourceId,allowExternal=false,expectedSignature}={}){
 const p=settlementPreview(s,id,sourceId),d=s.debts.find(x=>x.id===id);
 if(expectedSignature&&expectedSignature!==p.signature)throw Error('Os valores mudaram. Revise a quitação.');
 if(!validDate(date)||date>today())throw Error('Use a data do pagamento já realizado.');
 if(p.externalCents&&!allowExternal)throw Error('Confirme o valor pago fora desta reserva.');
 if(!p.amountCents){const c=cat(s,d.pocketId);if(c?.archived)throw Error('Esse compromisso já foi quitado.');finishDebtPocket(s,d.pocketId,date);return {funded:0,external:0};}
 // For shared legacy pockets, never spend another debt's reserved share.
 return payDebt(s,id,p.balance,{date,note:note||'Quitação confirmada',sourceId:p.sourceId,fundedLimit:p.fundedCents/100});
}
function previewFree(s,amount,{sourceId=primaryFree(s)?.id,at=today()}={}){
 const c=cat(s,sourceId);if(!c||c.archived||c.role!=='free')throw Error('Escolha o cofrinho Livre.');
 const value=cents(positive(amount)),available=Math.max(0,pocketCents(s,sourceId));
 if(value>available)throw Error('Esse valor ultrapassa o saldo Livre.');
 const p=allocation(s,value/100,at);if(p.error)throw Error(p.error);
 const shares=Object.fromEntries(Object.entries(p.shares).filter(([id,n])=>n>0&&cat(s,id)?.role!=='free'));
 const moved=Object.values(shares).reduce((n,v)=>n+v,0);
 return {sourceId,shares,amountCents:value,movedCents:moved,retainedCents:value-moved,availableCents:available,remainingFreeCents:available-moved,overflowCents:p.overflowCents||0,signature:fundingSignature(s)};
}
function distributeFree(s,amount,{sourceId=primaryFree(s)?.id,expectedSignature,date=today()}={}){
 if(!validDate(date)||date>today())throw Error('Use uma data de hoje ou anterior.');
 const p=previewFree(s,amount,{sourceId});
 if(expectedSignature&&expectedSignature!==p.signature)throw Error('Os saldos ou planos mudaram. Revise a divisão.');
 if(!p.movedCents)throw Error('Nada para separar: os planos estão completos ou precisam ser definidos.');
 transferEntries(s,p.sourceId,p.shares,{date,note:'Redistribuição do saldo Livre',reason:'free_distribution'});
 return p;
}
function payDebt(s,id,amount,{date=today(),note='',sourceId,fundedLimit}={}){
 const d=s.debts.find(d=>d.id===id&&!d.archived);if(!d)throw Error('Compromisso não encontrado.');amount=positive(amount);const before=debtBalance(s,d);if(!amount||cents(amount)>cents(before))throw Error('O pagamento deve ser maior que zero e não ultrapassar o compromisso.');if(!validDate(date)||date>today())throw Error('Use a data do pagamento já realizado.');
 const source=sourceId===undefined?d.pocketId:sourceId;
 if(source&&(!cat(s,source)||cat(s,source).archived))throw Error('Cofrinho de origem não encontrado.');
 const funded=source?Math.min(cents(amount),Math.max(0,pocketCents(s,source)),fundedLimit===undefined?Infinity:cents(positive(fundedLimit)))/100:0,link=uid();
 if(funded){const c=cat(s,source),b=pocket(s,source);c.movements.push({id:uid(),type:'spend',amount:funded,date,note:`Pagamento · ${d.name}`,linkId:link});recordActivity(s,'pocket',source,`Pagamento · ${d.name}`,b,money(b-funded),'','spend',date);}
 d.movements.push({id:uid(),type:'payment',amount,date,note,linkId:link,sourceId:source||'',funded});
 recordActivity(s,'debt',d.id,`Paguei · ${d.name}`,before,debtBalance(s,d),cents(funded)<cents(amount)?`${money(amount-funded)} pagos fora dos cofrinhos`:note,'payment',date);
 if(debtBalance(s,d)===0){d.settledAt=date;finishDebtPocket(s,d.pocketId,date);}
 return {funded,external:money(amount-funded)};
}
function archiveDebt(s,id){const d=s.debts.find(d=>d.id===id);if(!d)return;d.archived=true;const c=cat(s,d.pocketId);if(c&&!linkedDebts(s,c.id).length){c.role='custom';c.debtId='';c.targetAmount=0;c.targetDate='';}recordActivity(s,'debt',id,`Compromisso arquivado · ${d.name}`,debtBalance(s,d),debtBalance(s,d),'Saldo do cofrinho preservado','archive');}

function previewMove(s,id,action,amount,{destinationId=''}={}){
 const c=cat(s,id);if(!c||c.archived)throw Error('Cofrinho não encontrado.');
 const n=cents(positive(amount)),before=pocketCents(s,id);
 if(action==='transfer'){
  const dest=cat(s,destinationId);if(!dest||dest.archived||id===destinationId)throw Error('Escolha outro cofrinho.');
  if(n>Math.max(0,before))throw Error('Esse valor ultrapassa o saldo disponível.');
  const p=capShares(s,{[destinationId]:n}),spent=Object.entries(p.shares).filter(([key])=>key!==id).reduce((a,[,v])=>a+v,0);
  return {...p,before:before/100,after:(before-spent)/100,destinationId};
 }
 if(action==='deposit'){const p=capShares(s,{[id]:n});return {...p,before:before/100,after:(before+(p.shares[id]||0))/100};}
 return {before:before/100,after:action==='adjustment'?n/100:(before-n)/100,overflowCents:0};
}
function move(s,id,action,amount,{date=today(),note='',destinationId=''}={}){
 const c=cat(s,id);if(!c||c.archived)throw Error('Cofrinho não encontrado.');if(!validDate(date)||date>today())throw Error('Use uma data de hoje ou anterior.');
 amount=positive(amount);const before=pocket(s,id);let delta=amount;

 if(action==='transfer'){
  if(!amount)throw Error('Informe quanto quer transferir.');
  const p=previewMove(s,id,action,amount,{destinationId});
  const changed=transferEntries(s,id,p.shares,{date,note,reason:p.overflowCents?'target_cap':'transfer'});
  if(!changed)throw Error('O destino já está completo. Esse valor continua em Livre.');
  return p;
 }
 if(action==='deposit'){
  if(!amount)throw Error('Informe quanto colocou de fora no cofrinho.');
  const p=previewMove(s,id,action,amount),operationId=uid();
  for(const [key,n] of Object.entries(p.shares)){
   if(!n)continue;const dest=cat(s,key),b=pocket(s,key);
   dest.movements.push({id:uid(),type:'deposit',amount:n/100,date,note:note||(key!==id?'Excedente do aporte · '+c.label:''),operationId});
   recordActivity(s,'pocket',key,`Adicionei de fora · ${dest.label}`,b,pocket(s,key),note,'deposit',date);
  }
  return p;
 }
 if(action==='spend'){
  if(linkedDebts(s,id).length)throw Error('Registre o pagamento no compromisso vinculado.');
  if(!amount||cents(amount)>Math.max(0,pocketCents(s,id)))throw Error('Esse uso ultrapassa o saldo do cofrinho.');
 }else if(action==='deposit'){if(!amount)throw Error('Informe quanto colocou de fora no cofrinho.');}
 else if(action==='adjustment'){delta=money(amount-before);if(!delta)return;}
 else throw Error('Ação inválida.');
 c.movements.push({id:uid(),type:action,amount:delta,date,note});recordActivity(s,'pocket',id,`${{spend:'Usei',deposit:'Adicionei de fora',adjustment:'Saldo ajustado'}[action]} · ${c.label}`,before,pocket(s,id),note,action,date);
}
function setManual(s,values){const active=cats(s);const total=active.reduce((a,c)=>a+num(values[c.id]),0);if(Math.abs(total-100)>0.005)throw Error('A divisão precisa somar 100%.');for(const c of active){const v=num(values[c.id]);if(v<0||v>100)throw Error('Use percentuais de 0 a 100.');s.allocation[c.id]=v;if(v>0)c.planningPaused=false;}s.preferences.allocationMode='manual';recordActivity(s,'allocation','main','Divisão manual salva',100,100,'','configure');}
function summary(s,at){const month=at?at.slice(0,7):planningMonth(s);return {monthIncome:s.transactions.filter(t=>t.date.startsWith(month)).reduce((a,t)=>a+cents(t.value),0)/100,lifetimeIncome:s.transactions.reduce((a,t)=>a+cents(t.value),0)/100,pockets:s.allocationCategories.reduce((a,c)=>a+pocketCents(s,c.id),0)/100,pending:pendingCents(s)/100,free:cats(s).filter(c=>c.role==='free').reduce((a,c)=>a+pocketCents(s,c.id),0)/100,debts:s.debts.filter(d=>!d.archived).reduce((a,d)=>a+cents(debtBalance(s,d)),0)/100};}

/* Planejamento não é dinheiro. Estes comandos só alteram instruções futuras.
 * Nem virada nem reinício geram recebimentos, despesas ou redistribuição retroativa.
 */
function validMonth(value){return typeof value==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(value)&&Number(value.slice(0,4))>=1900&&Number(value.slice(0,4))<=9998;}
function planningMonth(s){return validMonth(s.planning?.month)?s.planning.month:today().slice(0,7);}
function nextMonth(month){if(!validMonth(month))throw Error('Mês inválido.');const [y,m]=month.split('-').map(Number);return `${m===12?y+1:y}-${String(m===12?1:m+1).padStart(2,'0')}`;}
function dateInMonth(month,day){if(!validMonth(month))throw Error('Mês inválido.');const[y,m]=month.split('-').map(Number),last=new Date(Date.UTC(y,m,0)).getUTCDate();return `${month}-${String(Math.max(1,Math.min(last,Number(day)||1))).padStart(2,'0')}`;}
function planState(s){
 return {month:planningMonth(s),monthly:positive(s.goals.monthly),weekly:positive(s.goals.weekly),financial:{id:s.goals.financial?.id||'financial-main',name:s.goals.financial?.name||'',target:positive(s.goals.financial?.target),targetDate:s.goals.financial?.targetDate||''},mode:s.preferences.allocationMode,autoConfigured:!!s.preferences.autoConfigured,allocation:clone(s.allocation),categories:s.allocationCategories.map(c=>({id:c.id,label:c.label,role:c.role,archived:!!c.archived,targetAmount:positive(c.targetAmount),targetDate:c.targetDate||'',planningPaused:!!c.planningPaused,recurrence:c.recurrence==='monthly'?'monthly':'once',recurrenceDay:Number(c.recurrenceDay)||Number((c.targetDate||'').slice(-2))||1,cycleSpentBaselineCents:c.cycleSpentBaselineCents??legacyCycleBaseline(c)}))};
}
function planSignature(s){return JSON.stringify(planState(s));}
function resetPlanPreview(s){
 const plans=cats(s).filter(c=>!c.planningPaused&&(target(s,c).amount>0||c.targetDate||c.recurrence==='monthly'));
 return {plans:plans.map(c=>({id:c.id,label:c.label,icon:c.icon,role:c.role,target:target(s,c).amount,balance:pocket(s,c.id),date:target(s,c).date})),clearIncome:positive(s.goals.monthly)>0||positive(s.goals.weekly)>0,canReset:plans.length>0||s.preferences.allocationMode==='manual'||!!s.preferences.autoConfigured||positive(s.goals.monthly)>0||positive(s.goals.weekly)>0,summary:summary(s)};
}
function ensurePlanning(s){if(!s.planning)s.planning={month:today().slice(0,7),closures:[],resets:[],undo:null};}
function resetPlanning(s,{expectedSignature}={}){
 if(expectedSignature&&expectedSignature!==planSignature(s))throw Error('O plano mudou. Revise a confirmação novamente.');
 if(!resetPlanPreview(s).canReset)throw Error('Seu planejamento já está vazio.');
 ensurePlanning(s);const before=planState(s),id=uid(),primaryFree=cats(s).find(c=>c.role==='free')?.id;
 for(const c of cats(s)){c.targetAmount=0;c.targetDate='';c.planningPaused=c.role!=='free';c.recurrence='once';c.recurrenceDay=1;c.cycleSpentBaselineCents=spentCents(c);s.allocation[c.id]=c.id===primaryFree?100:0;}
 s.goals.monthly=0;s.goals.weekly=0;s.goals.financial=clone(empty().goals.financial);
 s.preferences.allocationMode='auto';s.preferences.autoConfigured=false;
 s.planning.resets.push({id,kind:'reset',createdAt:new Date().toISOString(),date:today(),status:'done',before,currency:s.preferences.currency});
 s.planning.undo={id,kind:'reset',before,expected:planSignature(s)};
 recordActivity(s,'planning',id,'Planejamento recomeçado',0,0,'Saldos, ganhos, compromissos e pagamentos preservados','planning_reset');
 return id;
}
function monthMetrics(s,month){
 if(!validMonth(month))throw Error('Mês inválido.');
 const tx=s.transactions.filter(t=>t.date.startsWith(month));
 const spent=s.allocationCategories.flatMap(c=>c.movements||[]).filter(m=>m.type==='spend'&&m.date.startsWith(month));
 const debtPayments=s.debts.flatMap(d=>d.movements||[]).filter(m=>m.type==='payment'&&m.date.startsWith(month));
 return {incomeCents:tx.reduce((n,t)=>n+cents(t.value),0),spentCents:spent.reduce((n,m)=>n+cents(m.amount),0),debtPaidCents:debtPayments.reduce((n,m)=>n+cents(m.amount),0),incomeCount:tx.length,freeCents:cats(s).filter(c=>c.role==='free').reduce((n,c)=>n+pocketCents(s,c.id),0),pendingCents:pendingCents(s),pocketCents:s.allocationCategories.reduce((n,c)=>n+pocketCents(s,c.id),0),debtCents:s.debts.filter(d=>!d.archived).reduce((n,d)=>n+cents(debtBalance(s,d)),0)};
}
function rolloverPreview(s,at=today()){
 const from=planningMonth(s),to=nextMonth(from),actual=at.slice(0,7),limit=nextMonth(actual);
 const canAdvance=to<=limit&&!s.planning?.closures?.some(r=>r.month===from&&r.status!=='undone');
 const candidates=cats(s).filter(c=>!c.planningPaused&&!linkedDebts(s,c.id).length&&c.role==='custom'&&c.targetAmount>0&&validDate(c.targetDate)&&c.targetDate.slice(0,7)<=from).map(c=>({id:c.id,label:c.label,icon:c.icon,amount:positive(c.targetAmount),balance:pocket(s,c.id),fromDate:c.targetDate,toDate:dateInMonth(to,c.recurrence==='monthly'?c.recurrenceDay||Number(c.targetDate.slice(-2)):Number(c.targetDate.slice(-2))),monthly:c.recurrence==='monthly',complete:target(s,c,at).done,used:cycleSpent(s,c)}));
 return {from,to,actual,canAdvance,early:to>actual,candidates,metrics:monthMetrics(s,from),protectedGoals:cats(s).filter(c=>c.role==='goal'&&c.targetAmount>0).length,protectedDebts:s.debts.filter(d=>!d.archived&&debtBalance(s,d)>0).length};
}
function rollMonth(s,{expectedMonth,expectedSignature,renewIds=[],at=today()}={}){
 const p=rolloverPreview(s,at);
 if(expectedMonth!==p.from)throw Error('Essa virada já foi feita ou o mês mudou. Reabra a confirmação.');
 if(expectedSignature&&expectedSignature!==planSignature(s))throw Error('O plano mudou. Revise a virada novamente.');
 if(!p.canAdvance)throw Error('O próximo mês já está aberto. Aguarde o calendário avançar.');
 const ids=[...new Set(renewIds)];
 if(ids.some(id=>!p.candidates.some(c=>c.id===id)))throw Error('Um dos planos não pode ser renovado nesta virada.');
 ensurePlanning(s);const before=planState(s),id=uid();
 const renewed=p.candidates.filter(c=>ids.includes(c.id));
 // No transactions or pocket movements are created here. Existing cash carries over.
 for(const row of renewed){const c=cat(s,row.id);c.targetDate=row.toDate;c.cycleSpentBaselineCents=spentCents(c);}
 s.planning.month=p.to;
 const record={id,kind:'rollover',month:p.from,nextMonth:p.to,createdAt:new Date().toISOString(),date:today(),status:'done',currency:s.preferences.currency,metrics:p.metrics,renewed:clone(renewed),before};
 s.planning.closures.push(record);
 s.planning.undo={id,kind:'rollover',before,expected:planSignature(s)};
 recordActivity(s,'planning',id,`Virada de mês · ${p.from} → ${p.to}`,0,0,`${renewed.length} plano(s) renovado(s); saldos preservados`,'month_close');
 return record;
}
function canUndoPlanning(s){return !!s.planning?.undo&&s.planning.undo.expected===planSignature(s);}
function undoPlanning(s,id){
 const u=s.planning?.undo;
 if(!u||u.id!==id||!canUndoPlanning(s))throw Error('O planejamento mudou depois dessa ação. Confira a versão anterior no histórico.');
 const b=u.before;
 s.planning.month=b.month;s.goals.monthly=b.monthly;s.goals.weekly=b.weekly;Object.assign(s.goals.financial,b.financial);s.preferences.allocationMode=b.mode;s.preferences.autoConfigured=b.autoConfigured;s.allocation=clone(b.allocation);
 for(const previous of b.categories){const c=cat(s,previous.id);if(c)Object.assign(c,{targetAmount:previous.targetAmount,targetDate:previous.targetDate,planningPaused:previous.planningPaused,recurrence:previous.recurrence,recurrenceDay:previous.recurrenceDay,cycleSpentBaselineCents:previous.cycleSpentBaselineCents??0});}
 const record=(u.kind==='reset'?s.planning.resets:s.planning.closures).find(r=>r.id===u.id);if(record){record.status='undone';record.undoneAt=new Date().toISOString();}
 s.planning.undo=null;
 recordActivity(s,'planning',id,u.kind==='reset'?'Reinício do plano desfeito':'Virada de mês desfeita',0,0,'Só o planejamento foi restaurado; movimentações preservadas','planning_undo');
}


function upgradePlanningUndo(s){
 const u=s.planning.undo;
 const upgrade=plan=>{if(!plan?.categories)return plan;return {...plan,categories:plan.categories.map(c=>({...c,cycleSpentBaselineCents:c.cycleSpentBaselineCents??legacyCycleBaseline({...cat(s,c.id),...c})}))};};
 try{u.before=upgrade(u.before);u.expected=JSON.stringify(upgrade(JSON.parse(u.expected)));}catch{s.planning.undo=null;}
}
function restoreDebt(s,id){
 const d=s.debts.find(d=>d.id===id);if(!d)return;
 d.archived=false;const c=cat(s,d.pocketId);if(c&&debtBalance(s,d)>0){c.archived=false;c.closedForDebt=false;c.role='debt';c.debtId=d.id;}
 recordActivity(s,'debt',id,`Compromisso restaurado · ${d.name}`,debtBalance(s,d),debtBalance(s,d),'','archive');
}
function restorePocket(s,id){
 const c=cat(s,id);if(!c)return;
 if(c.closedForDebt)throw Error('Esse compromisso já foi quitado. Edite o compromisso para registrar um novo saldo.');
 c.archived=false;
}
function validate(s){for(const t of s.transactions){if(allocatedCents(t)>cents(t.value))throw Error('Um ganho tem mais dinheiro distribuído do que recebido.');}if(!CURRENCIES[s.preferences.currency])throw Error('Moeda inválida.');return true;}
const api={funding,cycleSpent,fundingCapacity,capShares,debtFunding,fundingSignature,settlementPreview,settleDebt,previewFree,distributeFree,previewMove,restoreDebt,restorePocket,validMonth,planningMonth,nextMonth,dateInMonth,planState,planSignature,resetPlanPreview,resetPlanning,monthMetrics,rolloverPreview,rollMonth,canUndoPlanning,undoPlanning,CURRENCIES,clone,num,cents,money,positive,uid,today,validDate,daysTo,afterMonths,parseMoney,fmt,empty,normalize,cats,cat,pocket,pocketCents,pocketStats,target,linkedDebts,debtBalance,debtPaid,contributionCents,allocatedCents,pendingCents,apportion,allocation,forecast,previewPending,applyPending,income,removeIncome,upsertPocket,archivePocket,upsertDebt,payDebt,archiveDebt,move,setManual,recordActivity,summary,validate};root.LL=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
