"""Cadastro real, IndexedDB/localStorage e WebCrypto em Chromium/localhost.
Fixtures vivem só no contexto temporário do teste; não são carregadas pelo app.
"""
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright
import os, json, tempfile
ROOT=Path(__file__).resolve().parents[1]
OUT=Path(tempfile.mkdtemp(prefix='life-lately-zero-qa-'))
class Handler(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(ROOT.parent)))
Thread(target=server.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{server.server_port}'
url=f'{base}/{ROOT.name}/app/'
checks=[]
def ok(text):
    checks.append(text);print('✓ '+text,flush=True)
try:
 with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path=os.environ.get('LL_BROWSER_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
    ctx=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    p=ctx.new_page();p.set_default_timeout(20000)
    errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
    p.goto(url);p.wait_for_selector('#accessForm')
    assert p.locator('#accessForm [name=name]').input_value()==''
    assert p.locator('#accessForm [name=password]').input_value()==''
    assert p.locator('#accessForm [name=confirm]').input_value()==''
    # Same origin old namespace: a realistic obstruction to an empty start.
    p.evaluate('''async()=>{
      localStorage.setItem('lifeLatelyAccountEmptyPreviewV2',JSON.stringify({username:'Perfil antigo',authSalt:'old',dataSalt:'old',authHash:'old'}));
      localStorage.setItem('lifeLatelyStateEmptyPreviewV1',JSON.stringify({goals:{monthly:62000},profile:{name:'Perfil antigo'}}));
      localStorage.setItem('otherAppUntouched','keep');
      await new Promise((resolve,reject)=>{let r=indexedDB.open('life-lately-db-empty-preview-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('app');r.onerror=()=>reject(r.error);r.onsuccess=()=>{let d=r.result,t=d.transaction('app','readwrite');t.objectStore('app').put({profile:{name:'Perfil antigo'},goals:{monthly:62000}},'state');t.oncomplete=()=>{d.close();resolve();};};});
    }''')
    p.reload();p.wait_for_selector('#accessForm [name=name]')
    assert 'Perfil antigo' not in p.locator('#access').inner_text()
    assert p.evaluate('LLStore.keys.ACCOUNT_KEY')=='lifeLatelyZeroV22Account'
    ok('Primeiro acesso não recupera o perfil nem os R$ 62 mil do armazenamento antigo')
    p.locator('#accessForm [name=name]').fill('Pessoa de teste')
    p.locator('#accessForm [name=password]').fill('Senha-teste-zero-123')
    p.locator('#accessForm [name=confirm]').fill('Senha-teste-zero-123')
    p.locator('#accessForm button[type=submit]').click()
    p.wait_for_function('state!==null && !document.getElementById("shell").hidden')
    data=p.evaluate('({summary:LL.summary(state),forecast:LL.forecast(state),state})')
    s=data['state'];assert not s['transactions'] and not s['debts'] and not s['activity']
    assert s['goals']['monthly']==s['goals']['weekly']==s['goals']['financial']['target']==0
    assert all(c['targetAmount']==0 and c['movements']==[] for c in s['allocationCategories'])
    assert all(v==0 for k,v in data['summary'].items() if isinstance(v,(float,int)))
    assert data['forecast']['monthly']==0 and not data['forecast']['hasTargets']
    ok('Cadastro real abre saldos, ganhos, dívidas, metas e projeções zerados')
    for screen in ['overview','income','organize','goals','debts','settings']:
      p.evaluate('(screen)=>showPage(screen)',screen)
      text=p.locator('#view').inner_text()
      assert '62.000' not in text and 'Perfil antigo' not in text
      assert p.evaluate('document.documentElement.scrollWidth<=innerWidth')
    p.evaluate('showPage("overview")')
    p.screenshot(path=str(OUT/'inicio-zerado.png'),full_page=True)
    ok('Seis telas iniciais sem valores fictícios e sem overflow em 390 px')
    # Real create and save, not the persistence stub used by the legacy UI suite.
    p.locator('#view [data-action=new-pocket]').first.click()
    p.locator('#pocketForm [name=label]').fill('Aluguel')
    p.locator('#pocketForm [name=target]').fill('400')
    p.locator('#pocketForm [data-action=date-shortcut][data-id="1"]').click()
    p.locator('#pocketForm [type=submit]').click()
    p.wait_for_function('!document.getElementById("dialog").open')
    p.evaluate('showPage("overview")')
    p.locator('#view [data-action=new-income]').click()
    p.locator('#incomeForm [name=amount]').fill('100')
    p.locator('#incomeForm [type=submit]').click()
    p.wait_for_function('!document.getElementById("dialog").open || !!document.querySelector(".receipt")')
    p.keyboard.press('Escape')
    assert p.evaluate('LL.summary(state).lifetimeIncome')==100
    p.reload();p.wait_for_selector('#accessForm [name=password]')
    assert p.locator('#accessForm [name=name]').count()==0
    p.locator('#accessForm [name=password]').fill('Senha-teste-zero-123')
    p.locator('#accessForm [type=submit]').click()
    p.wait_for_function('state!==null')
    assert p.evaluate('LL.summary(state).lifetimeIncome')==100
    assert p.evaluate('state.allocationCategories.some(c=>c.label==="Aluguel" && c.targetAmount===400)')
    ok('Primeiro cofrinho e ganho persistem após recarregar e entrar com a senha')
    # Protect against overwriting from another still-unlocked tab after reset.
    old=ctx.new_page();old.goto(url);old.wait_for_selector('#accessForm')
    old.locator('#accessForm [name=password]').fill('Senha-teste-zero-123')
    old.locator('#accessForm [type=submit]').click();old.wait_for_function('state!==null')
    p.evaluate('showPage("settings")')
    p.locator('#view [data-action=backup]').click()
    p.locator('#dialog [data-action=reset]').click()
    p.locator('#resetForm [name=confirm]').fill('APAGAR')
    p.locator('#resetForm [type=submit]').click()
    p.wait_for_selector('#accessForm [name=name]')
    assert p.evaluate('LLStore.readAccount()') is None
    assert p.evaluate('LLStore.isUnlocked()') is False
    assert p.evaluate('localStorage.getItem(LLStore.keys.FALLBACK)') is None
    assert p.evaluate('''async()=>{let db=await new Promise((res,rej)=>{let r=indexedDB.open(LLStore.keys.DB_NAME,1);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});try{return await new Promise(res=>{let r=db.transaction('app','readonly').objectStore('app').get('state');r.onsuccess=()=>res(r.result??null);});}finally{db.close();}}''') is None
    assert p.locator('#accessForm [name=name]').input_value()==''
    assert p.locator('#accessForm [name=password]').input_value()==''
    assert p.locator('#accessForm [name=confirm]').input_value()==''
    ok('Recomeçar apaga perfil, senha e dados nos dois armazenamentos e volta ao cadastro')
    result=old.evaluate('''async()=>{try{await LLStore.save(state);return 'saved';}catch(e){return e.message;}}''')
    assert 'outra aba' in result
    ok('Aba antiga não ressuscita os dados apagados')
    assert p.evaluate('localStorage.getItem("otherAppUntouched")')=='keep'
    assert p.evaluate('JSON.parse(localStorage.getItem("lifeLatelyStateEmptyPreviewV1")).goals.monthly')==62000
    ok('Limpeza não atinge outros aplicativos nem namespaces anteriores')
    p.locator('#accessForm [name=name]').fill('Novo acesso')
    p.locator('#accessForm [name=password]').fill('Nova-senha-teste-123')
    p.locator('#accessForm [name=confirm]').fill('Nova-senha-teste-123')
    p.locator('#accessForm [type=submit]').click();p.wait_for_function('state!==null')
    assert p.evaluate('LL.summary(state).lifetimeIncome')==0
    assert p.evaluate('state.allocationCategories.length')==1
    ok('É possível criar um novo perfil vazio após apagar o anterior')
    preview=ROOT.parent/'life-lately-zero-preview.html'
    if preview.exists():
      preview_page=ctx.new_page();preview_page.goto(f'{base}/{preview.name}');preview_page.wait_for_selector('#accessForm [name=name]')
      assert preview_page.evaluate('LLStore.keys.ACCOUNT_KEY')=='lifeLatelyZeroV22PreviewAccount'
      assert preview_page.locator('#accessForm [name=name]').input_value()==''
      ok('Prévia HTML abre um cadastro independente, sem carregar o teste do pacote')
    assert not errors,errors
    ok('Nenhum erro de JavaScript nos fluxos exercitados')
    (OUT/'report.json').write_text(json.dumps({'checks':checks,'errors':errors,'storage':'real Chromium WebCrypto + IndexedDB + localStorage, localhost'},ensure_ascii=False,indent=2))
    browser.close()
    print(f'\n{len(checks)} verificações concluídas. Relatório: {OUT}')
finally:
 server.shutdown()
