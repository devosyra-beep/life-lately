"""Chromium UI. LL_QA_OFFLINE=1 uses an explicit test storage adapter (no network)."""
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright
import os,json,tempfile,re
ROOT=Path(__file__).resolve().parents[1]
OUT=Path(os.environ.get('LL_QA_OUT',tempfile.mkdtemp(prefix='ll-v24-qa-')));OUT.mkdir(exist_ok=True,parents=True)
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
srv=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)))
Thread(target=srv.serve_forever,daemon=True).start();checks=[]
OFFLINE=os.environ.get('LL_QA_OFFLINE')=='1'
def ok(msg):checks.append(msg);print('✓ '+msg,flush=True)
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path=os.environ.get('LL_BROWSER_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
  ctx=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
  p=ctx.new_page();p.set_default_timeout(10000);errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
  if OFFLINE:
   html=(ROOT/'app/index.html').read_text()
   html=re.sub(r'<script[^>]*src="[^"]+"[^>]*></script>','',html)
   html=re.sub(r'<link[^>]+>','',html)
   html=html.replace('</head>','<meta name="ll-preview" content="true"><style>'+(ROOT/'styles.css').read_text()+'</style></head>')
   p.set_content(html)
   p.add_script_tag(content="if(!crypto.subtle)Object.defineProperty(crypto,'subtle',{value:{},configurable:true});")
   for asset in ['core.js','storage.js']:p.add_script_tag(content=(ROOT/asset).read_text())
   p.add_script_tag(content="""window.QAAccount=null;window.QASaved=null;window.QAOpen=false;
    window.LLStore={...LLStore,readAccount:()=>QAAccount,keys:LLStore.keys,
     create:async(name,password)=>{QAAccount={username:name,qaPassword:password};let s=LL.empty();s.profile.name=name;QASaved=structuredClone(s);QAOpen=true;return s;},
     save:async s=>{if(!QAOpen)throw Error('Desbloqueie');QASaved=structuredClone(s);},
     unlock:async password=>{if(password!==QAAccount.qaPassword)throw Error('Senha incorreta');QAOpen=true;return LL.normalize(structuredClone(QASaved));},
     lock:async()=>{QAOpen=false;},isUnlocked:()=>QAOpen};""")
   p.add_script_tag(content=(ROOT/'app.js').read_text());p.evaluate('document.dispatchEvent(new Event("DOMContentLoaded"))')
  else:p.goto(f'http://127.0.0.1:{srv.server_port}/app/')
  p.wait_for_selector('#accessForm')
  def snap(name):p.screenshot(path=str(OUT/name),full_page=False,animations='disabled')
  def nav(name):p.evaluate('(name)=>showPage(name)',name)
  def close():
   if p.locator('#dialog').evaluate('(el)=>el.open'):p.keyboard.press('Escape')
  def submit(name):
   p.locator(f'#{name} [type=submit]').click();p.wait_for_function('!busy')
   err=p.locator('#dialogError')
   assert not (err.count() and err.is_visible()),err.inner_text() if err.count() else ''
  p.locator('#accessForm [name=name]').fill('Teste local')
  p.locator('#accessForm [name=password]').fill('QA-v24!teste-reservas')
  p.locator('#accessForm [name=confirm]').fill('QA-v24!teste-reservas');submit('accessForm')
  p.wait_for_function('!!state');assert p.evaluate('LL.summary(state).pockets')==0
  ok('Cadastro real começa sem dinheiro, dívida ou objetivo pré-carregado')
  nav('organize');p.locator('#view [data-action=new-pocket]').first.click()
  p.locator('#pocketForm [name=label]').fill('Aluguel');p.locator('#pocketForm [name=target]').fill('100')
  due=p.evaluate('LL.dateInMonth(LL.planningMonth(state),30)')
  p.locator('#pocketForm [name=targetDate]').fill(due);p.locator('[name=repeatMonthly]').check();submit('pocketForm')
  rent=p.evaluate('state.allocationCategories.find(c=>c.label==="Aluguel").id')
  nav('debts');p.locator('#view [data-action=new-debt]').first.click()
  p.locator('#debtForm [name=name]').fill('Cartão');p.locator('#debtForm [name=total]').fill('40');p.locator('[name=due]').fill(due);submit('debtForm')
  debt=p.evaluate('state.debts[0].id');dp=p.evaluate('state.debts[0].pocketId')
  def income(value):
   nav('overview');p.locator('#view [data-action=new-income]').first.click();p.locator('#incomeForm [name=amount]').fill(value)
   submit('incomeForm');close()
  income('200');assert p.evaluate('LL.summary(state).free')==60
  assert p.evaluate('(id)=>LL.pocket(state,id)',rent)==100
  ok('Ganhei 200 reserva 100 de aluguel + 40 de dívida; 60 excedentes em Livre')
  nav('organize');p.locator('#view [data-action=allocation]').click();p.locator('[data-action=allocation-mode][data-id=manual]').click()
  assert p.locator('.manual-complete').count()==2
  slider=p.locator(f'[data-slider="{rent}"]');slider.evaluate('(el)=>window.oldSlider=el');slider.scroll_into_view_if_needed();box=slider.bounding_box()
  p.mouse.move(box['x']+3,box['y']+box['height']/2);p.mouse.down();p.mouse.move(box['x']+box['width']*.72,box['y']+box['height']/2,steps=14);p.mouse.up()
  assert p.evaluate('window.oldSlider.isConnected');assert float(slider.input_value())>60
  for cid,value in [(rent,'80'),(dp,'0'),('livre','20')]:p.locator(f'[data-pct-number="{cid}"]').fill(value)
  assert 'Livre' in p.locator('#manualEffective').inner_text();assert '100,00' in p.locator('#manualEffective').inner_text()
  assert '100%' in p.locator('#manualPct').inner_text();snap('01-manual-limite.png');submit('allocationForm')
  income('100');assert p.evaluate('(id)=>LL.pocket(state,id)',rent)==100
  assert p.evaluate('LL.summary(state).free')==160
  ok('Arraste contínuo preservado, previsão efetiva e modo manual respeitam cofrinhos completos')
  nav('debts');assert 'falta separar' in p.locator('#view').inner_text()
  p.locator(f'#view [data-action=debt-open][data-id="{debt}"]').click()
  assert 'Pronta para quitar' in p.locator('#dialog').inner_text();snap('02-divida-reservada.png')
  p.locator('[data-action=debt-settle]').click()
  assert p.locator('#settleConfirmation').inner_text()=='Já fiz esse pagamento.'
  assert p.evaluate('LL.debtPaid(state.debts[0])')==0
  snap('03-confirmacao-quitei.png');p.locator('#settleForm [name=confirmPaid]').check();submit('settleForm')
  assert p.evaluate('LL.debtPaid(state.debts[0])')==40
  assert p.evaluate('(id)=>LL.cat(state,id).archived',dp)
  nav('organize');assert p.locator(f'#view [data-action=pocket][data-id="{dp}"]').count()==0
  assert p.evaluate('LL.summary(state).lifetimeIncome')==300
  assert p.evaluate('LL.summary(state).free')==160
  ok('Quitei exige confirmação, dá baixa uma vez e tira o cofrinho de Organizar sem apagar histórico')
  # Local persistence round-trip, not a stub.
  if OFFLINE:p.evaluate('lock()')
  else:p.reload()
  p.wait_for_selector('#accessForm');p.locator('#accessPassword').fill('QA-v24!teste-reservas');submit('accessForm');p.wait_for_function('!!state')
  assert p.evaluate('LL.debtPaid(state.debts[0])')==40;assert p.evaluate('(id)=>LL.cat(state,id).archived',dp)
  ok('Bloqueio e reentrada preservam quitação/saldos'+(' (adaptador de teste)' if OFFLINE else ' (IndexedDB/WebCrypto)'))
  nav('organize');p.locator(f'#view [data-action=pocket][data-id="{rent}"]').click();p.locator('[data-action=pocket-move]').click()
  assert p.locator('#moveType').input_value()=='spend';p.locator('#moveForm [name=amount]').fill('100');submit('moveForm');close()
  income('10');assert p.evaluate('(id)=>LL.pocket(state,id)',rent)==0;assert p.evaluate('LL.summary(state).free')==170
  nav('organize');assert 'Atendido neste ciclo' in p.locator('#view').inner_text()
  ok('Aluguel mensal já pago não volta a receber no mesmo ciclo, nem no manual')
  p.locator('#view [data-action=month-rollover]').click()
  assert p.locator(f'[name=renewPocket][value="{rent}"]').is_checked()
  assert 'Livre que continua' in p.locator('#dialog').inner_text();snap('04-virada-livre.png')
  submit('monthRolloverForm');assert p.evaluate('LL.summary(state).monthIncome')==0
  assert p.evaluate('LL.summary(state).free')==170
  p.locator('#dialog [data-action=free-distribute]').click()
  assert p.locator('#freeForm [name=amount]').input_value()=='170,00'
  assert '100,00' in p.locator('#freePreview').inner_text();assert '70,00' in p.locator('#freePreview').inner_text()
  snap('05-distribuir-livre.png');submit('freeForm');assert p.evaluate('LL.summary(state).free')==70
  assert p.evaluate('(id)=>LL.pocket(state,id)',rent)==100
  assert p.evaluate('LL.summary(state).lifetimeIncome')==310
  assert p.evaluate('LL.summary(state).monthIncome')==0
  ok('Virada conserva Livre; redistribuir respeita o novo alvo sem gerar renda nem duplicar saldo')
  close();nav('organize');p.locator('#view [data-action=free-distribute]').click()
  assert p.locator('#freeForm [type=submit]').is_disabled();assert 'Nenhum plano precisa receber' in p.locator('#freePreview').inner_text();close()
  ok('Com todos os planos completos, redistribuição vira no-op e dinheiro continua Livre')
  # Partial reserve → explicit acknowledgement of outside funds.
  nav('debts');p.locator('#view [data-action=new-debt]').first.click()
  p.locator('#debtForm [name=name]').fill('Luz atrasada');p.locator('#debtForm [name=total]').fill('30');submit('debtForm')
  nd=p.evaluate('state.debts.at(-1).id')
  p.locator(f'#view [data-action=debt-open][data-id="{nd}"]').click();p.locator('[data-action=debt-settle]').click()
  assert '30,00 fora desta reserva' in p.locator('#settleConfirmation').inner_text();close()
  ok('Quitação sem reserva informa o complemento e não é executada só por abrir o modal')
  nav('settings');p.locator('#view [data-action=currency]').click();p.locator('#currencySelect').select_option('CNY');p.locator('[name=confirmCurrency]').check();submit('currencyForm')
  nav('organize');assert 'CN¥' in p.locator('#view').inner_text()
  for w in [320,360,390,768,1280,1440]:
   p.set_viewport_size({'width':w,'height':900});nav('organize')
   assert p.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),f'overflow {w}'
   nav('debts');p.locator(f'#view [data-action=debt-open][data-id="{nd}"]').click()
   assert p.locator('#dialog').evaluate('(el)=>el.scrollWidth<=el.clientWidth+1'),f'dialog overflow {w}'
   assert p.locator('[data-action=debt-settle]').is_visible();close()
  ok('Moeda global e interface verificados de 320 a 1440 px, sem rolagem horizontal')
  p.set_viewport_size({'width':390,'height':844});nav('organize');snap('06-organizar-final.png')
  if not OFFLINE:
   # Offline app shell with real service worker.
   p.evaluate('navigator.serviceWorker.ready');p.reload();p.wait_for_selector('#accessForm');ctx.set_offline(True);p.reload();p.wait_for_selector('#accessForm')
   p.locator('#accessPassword').fill('QA-v24!teste-reservas');submit('accessForm');p.wait_for_function('!!state')
   assert p.evaluate('LL.summary(state).lifetimeIncome')==310
   assert p.evaluate('state.preferences.currency')=='CNY';ctx.set_offline(False)
   ok('Após carregamento online, reabre offline com login e dados persistidos')
  else:print('— Service worker e recarregamento offline no navegador: não executados neste modo.',flush=True)
  assert not errors,errors
  ok('Nenhuma exceção JavaScript nos fluxos testados')
  (OUT/'completion-ui-report.json').write_text(json.dumps({'browser':'Chromium','realStorage':not OFFLINE,'serviceWorkerInBrowser':not OFFLINE,'checks':checks,'errors':errors},ensure_ascii=False,indent=2))
  browser.close()
finally:srv.shutdown()
print(f'\n{len(checks)} grupos de UI concluídos. Evidências: {OUT}')
