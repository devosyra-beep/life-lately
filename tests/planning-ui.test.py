"""Real Chromium/localhost UI + WebCrypto persistence. Test-only temporary profile."""
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright
import os, json, tempfile, re
ROOT=Path(__file__).resolve().parents[1]
OUT=Path(os.environ.get('LL_QA_OUT', tempfile.mkdtemp(prefix='life-lately-planning-qa-'))); OUT.mkdir(exist_ok=True,parents=True)
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
OFFLINE=os.environ.get('LL_QA_OFFLINE')=='1'
checks=[]
def ok(msg): checks.append(msg);print('✓ '+msg,flush=True)
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path=os.environ.get('LL_BROWSER_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
  ctx=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
  p=ctx.new_page();p.set_default_timeout(15000);errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
  if OFFLINE:
   html=(ROOT/'app/index.html').read_text()
   html=re.sub(r'<script[^>]*src="[^"]+"[^>]*></script>','',html)
   html=re.sub(r'<link[^>]+>','',html)
   html=html.replace('</head>','<meta name="ll-preview" content="true"><style>'+(ROOT/'styles.css').read_text()+'</style></head>')
   p.set_content(html)
   for asset in ['core.js','storage.js']:p.add_script_tag(content=(ROOT/asset).read_text())
   p.add_script_tag(content="""window.QAAccount=null;window.QASaved=null;window.QAOpen=false;
    window.LLStore={...LLStore,readAccount:()=>QAAccount,keys:LLStore.keys,
     create:async(name,password)=>{QAAccount={username:name,qaPassword:password};let s=LL.empty();s.profile.name=name;QASaved=structuredClone(s);QAOpen=true;return s;},
     save:async s=>{if(!QAOpen)throw Error('Desbloqueie');QASaved=structuredClone(s);},
     unlock:async password=>{if(password!==QAAccount.qaPassword)throw Error('Senha incorreta');QAOpen=true;return LL.normalize(structuredClone(QASaved));},
     lock:async()=>{QAOpen=false;},isUnlocked:()=>QAOpen};""")
   p.add_script_tag(content=(ROOT/'app.js').read_text());p.evaluate('document.dispatchEvent(new Event("DOMContentLoaded"))')
  else:p.goto(f'http://127.0.0.1:{server.server_port}/app/')
  p.wait_for_selector('#accessForm')
  def reload_ui():
   if OFFLINE:p.evaluate('lock()')
   else:p.reload()

  p.locator('#accessForm [name=name]').fill('Teste de planejamento')
  p.locator('#accessForm [name=password]').fill('Testes!de-planejamento123')
  p.locator('#accessForm [name=confirm]').fill('Testes!de-planejamento123')
  p.locator('#accessForm [type=submit]').click();p.wait_for_function('!!state && !busy')
  def nav(name):p.evaluate('(name)=>showPage(name)',name)
  def close():
   if p.locator('#dialog').evaluate('(el)=>el.open'):p.keyboard.press('Escape')
  def submit(form):
   p.locator(f'#{form} [type=submit]').click();p.wait_for_function('!busy')
  def snap(label):p.screenshot(path=str(OUT/label),full_page=False,animations='disabled')
  def no_overflow():assert p.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
  def finance():return p.evaluate('JSON.stringify({t:state.transactions,d:state.debts,m:state.allocationCategories.map(c=>c.movements),b:LL.summary(state).pockets,p:LL.summary(state).pending,n:state.profile})')
  nav('organize');p.wait_for_selector('.planning-tool')
  assert p.locator('#view [data-action=month-rollover]').is_visible()
  assert p.locator('#view [data-action=planning-reset]').is_visible()
  box=p.locator('.planning-tools').bounding_box();assert box['y']+box['height']<650
  assert p.evaluate('LL.summary(state).pockets')==0
  ok('Dois atalhos no alto de Organizar, cadastro começa vazio')
  p.locator('#view [data-action=planning-reset]').click();assert 'já está zerado' in p.locator('#dialogTitle').inner_text();close()
  ok('Recomeçar sem planos não cria operações nem apaga o acesso')
  month=p.evaluate('LL.planningMonth(state)');due=p.evaluate('LL.dateInMonth(LL.planningMonth(state),30)')
  for name,target,repeat in [('Aluguel','400',True),('Luz','30',False)]:
   p.locator('#view [data-action=new-pocket]').first.click()
   p.locator('#pocketForm [name=label]').fill(name);p.locator('#pocketForm [name=target]').fill(target)
   p.locator('#pocketForm [name=targetDate]').fill(due)
   if repeat:p.locator('#pocketForm [name=repeatMonthly]').check()
   submit('pocketForm');p.wait_for_function('!document.getElementById("dialog").open')
  nav('goals');p.locator('#view [data-action=new-goal]').first.click()
  p.locator('#pocketForm [name=label]').fill('Viagem longa');p.locator('#pocketForm [name=target]').fill('1000')
  p.locator('#pocketForm [name=targetDate]').fill(p.evaluate('LL.afterMonths(360)'))
  assert p.locator('[name=repeatMonthly]').count()==0
  submit('pocketForm');p.wait_for_function('!document.getElementById("dialog").open')
  nav('debts');p.locator('#view [data-action=new-debt]').first.click()
  p.locator('#debtForm [name=name]').fill('Cartão');p.locator('#debtForm [name=total]').fill('40');p.locator('#debtForm [name=due]').fill(due)
  submit('debtForm');p.wait_for_function('!document.getElementById("dialog").open')
  nav('overview');p.locator('#view [data-action=new-income]').first.click();p.locator('#incomeForm [name=amount]').fill('100');submit('incomeForm');p.wait_for_function('state.transactions.length===1');close()
  nav('debts');p.locator('#view .debt-card').click();p.locator('[data-action=debt-tab][data-tab=partial]').click();p.locator('#payForm [name=amount]').fill('2');submit('payForm');close()
  ok('Plano mensal, despesa avulsa, meta de 30 anos, ganho e pagamento funcionam pela UI')
  nav('organize');snap('01-organizar-atalhos.png');before=finance();oldDate=p.evaluate('state.allocationCategories.find(c=>c.label==="Viagem longa").targetDate')
  p.locator('#view [data-action=month-rollover]').click()
  rent=p.locator('.renewal-row').filter(has_text='Aluguel').locator('input');light=p.locator('.renewal-row').filter(has_text='Luz').locator('input')
  assert rent.is_checked();assert not light.is_checked();assert 'Viagem longa' not in p.locator('#monthRolloverForm').inner_text();snap('02-virar-confirmacao.png')
  p.locator('#dialog [data-action=close]').last.click();assert finance()==before
  ok('Virada pré-seleciona apenas recorrentes; cancelar não modifica nada')
  p.locator('#view [data-action=month-rollover]').click();submit('monthRolloverForm');p.wait_for_function('state.planning.closures.length===1')
  assert finance()==before;assert p.evaluate('LL.planningMonth(state)')!=month
  assert p.evaluate('state.allocationCategories.find(c=>c.label==="Viagem longa").targetDate')==oldDate
  assert p.evaluate('state.debts[0].due')==due
  assert p.evaluate('state.allocationCategories.find(c=>c.label==="Luz").targetDate')==due
  close();nav('overview');assert p.evaluate('LL.summary(state).monthIncome')==0
  nav('income');assert p.locator('#monthFilter').input_value()==p.evaluate('LL.planningMonth(state)')
  p.locator('#monthFilter').select_option(month);assert 'R$ 100,00' in p.locator('.income-summary').inner_text()
  nav('goals');assert 'Viagem longa' in p.locator('#view').inner_text();nav('organize')
  ok('Virada atualiza Início, Ganhos e mês de referência sem zerar metas/saldos/dívidas')
  reload_ui();p.wait_for_selector('#accessForm [name=password]');assert p.locator('#accessForm [name=confirm]').count()==0
  p.locator('#accessForm [name=password]').fill('Testes!de-planejamento123');submit('accessForm');p.wait_for_function('!!state && !busy')
  assert p.evaluate('state.planning.closures.length')==1;assert p.evaluate('LL.canUndoPlanning(state)')
  nav('organize');p.locator('#view [data-action=month-rollover]').click();assert 'já está aberto' in p.locator('#dialogTitle').inner_text();close()
  ok('Reabertura mantém virada e bloqueia segundo avanço futuro')
  p.locator('#view [data-action=planning-undo]').click();submit('planningUndoForm');p.wait_for_function('!document.getElementById("dialog").open')
  assert p.evaluate('LL.planningMonth(state)')==month;assert finance()==before
  ok('Desfazer virada devolve mês/datas sem tocar na movimentação')
  p.locator('#view [data-action=planning-reset]').click();snap('03-recomecar-confirmacao.png')
  submit('planningResetForm');assert p.evaluate('state.planning.resets.length')==0
  p.locator('#planningResetForm [name=confirmResetPlan]').check();submit('planningResetForm');p.wait_for_function('state.planning.resets.length===1');close()
  assert finance()==before;assert p.evaluate('!LL.forecast(state).hasTargets');nav('goals');assert 'Viagem longa' not in p.locator('#view').inner_text()
  nav('debts');assert 'Cartão' in p.locator('#view').inner_text();nav('organize');assert 'Toque para replanejar' in p.locator('#view').inner_text();snap('04-plano-reiniciado.png')
  ok('Reinício exige confirmação e limpa apenas planejamento em todas as telas')
  reload_ui();p.wait_for_selector('#accessForm [name=password]');p.locator('#accessForm [name=password]').fill('Testes!de-planejamento123');submit('accessForm');p.wait_for_function('!!state && !busy')
  assert p.evaluate('!LL.forecast(state).hasTargets && LL.canUndoPlanning(state)')
  nav('organize');p.locator('#view [data-action=planning-undo]').click();submit('planningUndoForm');p.wait_for_function('!document.getElementById("dialog").open');assert p.evaluate('LL.forecast(state).hasTargets')
  ok('Reinício/desfazer continuam corretos após fechar, autenticar e reabrir')
  p.locator('#view [data-action=planning-history]').click();assert p.locator('#dialog .row-card').count()==2
  p.locator('#dialog [data-action=planning-record]').first.click();assert 'Desfeito' in p.locator('#dialog').inner_text();close()
  ok('Histórico mostra reinício e virada, inclusive ações desfeitas')
  # No horizontal overflow, labels remain visible, action hit areas usable.
  for w in [320,360,390,768,1280,1440]:
   p.set_viewport_size({'width':w,'height':900});nav('organize');no_overflow()
   for a in ['month-rollover','planning-reset']:
    b=p.locator(f'#view [data-action={a}]').bounding_box();assert b['height']>=44;assert b['width']>=44
   p.locator('#view [data-action=planning-reset]').click();no_overflow()
   assert p.locator('#dialog').evaluate('(d)=>d.scrollWidth<=d.clientWidth+1');close()
   p.locator('#view [data-action=month-rollover]').click();no_overflow()
   assert p.locator('#dialog').evaluate('(d)=>d.scrollWidth<=d.clientWidth+1');close()
  ok('Organizar e os dois modais sem overflow em 320, 360, 390, 768, 1280 e 1440 px')
  p.set_viewport_size({'width':390,'height':844});nav('organize');p.locator('#view [data-action=planning-reset]').click()
  p.keyboard.press('Tab');assert p.locator('#dialog').evaluate('(d)=>d.contains(document.activeElement)');p.keyboard.press('Escape');assert not p.locator('#dialog').evaluate('(d)=>d.open')
  ok('Modal mantém foco de teclado e Escape cancela sem alteração')
  # Inject only a write failure, to verify UI transactional semantics.
  p.evaluate('window._savedSave=LLStore.save;LLStore.save=async()=>{throw Error("Falha simulada ao salvar")};void 0')
  unchanged=finance();p.locator('#view [data-action=planning-reset]').click();p.locator('#planningResetForm [name=confirmResetPlan]').check();submit('planningResetForm')
  assert 'Falha simulada' in p.locator('#dialogError').inner_text();assert finance()==unchanged;assert p.evaluate('LL.forecast(state).hasTargets')
  p.evaluate('LLStore.save=window._savedSave;void 0');close();ok('Erro de gravação não limpa o plano nem mostra sucesso falso')
  assert errors==[],errors;ok('Nenhum erro de JavaScript durante os fluxos')
  browser.close()
finally:
 server.shutdown()
 (OUT/'planning-ui-results.json').write_text(json.dumps({'checks':checks,'count':len(checks),'storageMode':'memory IO' if OFFLINE else 'real browser IO'},ensure_ascii=False,indent=2))
 print(f'{len(checks)} verificações UI. Imagens: {OUT}',flush=True)
