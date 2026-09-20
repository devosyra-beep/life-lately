"""Empty-state and full-reset UI checks in Chromium. Persistence is stubbed here;
real crypto + storage semantics are separately covered by zero-storage.test.cjs.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json, re, os, tempfile
R=Path(__file__).resolve().parents[1];OUT=Path(tempfile.mkdtemp(prefix='life-lately-zero-visual-'))
html=(R/'app/index.html').read_text()
html=re.sub(r'<script[^>]*src="[^"]+"[^>]*></script>','',html)
html=re.sub(r'<link[^>]+>','',html)
html=html.replace('</head>','<meta name="ll-preview" content="true"><style>'+(R/'styles.css').read_text()+'</style></head>')
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path=os.environ.get('LL_BROWSER_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':390,'height':844});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html)
 page.add_script_tag(content="if(!crypto.subtle)Object.defineProperty(crypto,'subtle',{value:{},configurable:true});")
 page.add_script_tag(content=(R/'core.js').read_text())
 page.add_script_tag(content='''window.__testAccount=null;window.__testData=null;window.__erased=0;
 window.LLStore={readAccount:()=>window.__testAccount,create:async(name,password)=>{window.__testAccount={username:name};const s=LL.empty();s.profile.name=name;window.__testData=structuredClone(s);return s;},save:async(s)=>{window.__testData=structuredClone(s);},erase:async()=>{window.__testAccount=null;window.__testData=null;window.__erased++;},lock:async()=>{},isUnlocked:()=>true};''')
 page.add_script_tag(content=(R/'app.js').read_text());page.evaluate('document.dispatchEvent(new Event("DOMContentLoaded"))')
 assert page.locator('#accessForm [name=name]').input_value()==''
 assert page.locator('#accessForm [name=password]').input_value()==''
 assert page.locator('#accessForm [name=confirm]').input_value()==''
 page.screenshot(path=str(OUT/'01-cadastro-vazio.png'),full_page=True)
 print('✓ Cadastro sem nome ou senha preenchidos')
 page.locator('#accessForm [name=name]').fill('Teste')
 page.locator('#accessForm [name=password]').fill('password-new')
 page.locator('#accessForm [name=confirm]').fill('password-new')
 page.locator('#accessForm [type=submit]').click();page.wait_for_function('state!==null')
 assert page.evaluate('state.transactions.length===0 && state.debts.length===0 && state.activity.length===0')
 for screen in ['overview','income','organize','goals','debts','settings']:
  page.evaluate('(s)=>showPage(s)',screen)
  assert '62.000' not in page.locator('#view').inner_text()
  assert page.evaluate('LL.forecast(state).daily===0 && LL.summary(state).pockets===0 && state.goals.monthly===0 && state.goals.weekly===0')
 page.evaluate('showPage("overview")');page.screenshot(path=str(OUT/'02-inicio-zerado.png'),full_page=True)
 print('✓ Seis telas vazias, sem projeção de renda ou meta mínima')
 page.evaluate('showPage("settings")');page.locator('[data-action=backup]').click();page.locator('[data-action=reset]').click()
 page.locator('#resetForm [name=confirm]').fill('ERRADO');page.locator('#resetForm [type=submit]').click()
 page.wait_for_selector('#dialogError:not([hidden])');assert page.evaluate('__erased')==0
 page.locator('#resetForm [name=confirm]').fill('APAGAR');page.locator('#resetForm [type=submit]').click()
 page.wait_for_selector('#accessForm [name=name]')
 assert page.evaluate('__erased')==1
 assert page.evaluate('state===null && __testData===null && __testAccount===null')
 assert page.locator('#accessForm [name=name]').input_value()==''
 assert page.locator('#accessForm [name=password]').input_value()==''
 assert page.locator('#accessForm [name=confirm]').input_value()==''
 assert page.locator('#view').inner_html()==''
 assert page.locator('#dialogRoot').inner_html()==''
 print('✓ Reset confirma a exclusão e limpa perfil, formulário e telas da sessão')
 for width in [320,390,1440]:
  page.set_viewport_size({'width':width,'height':900})
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 print('✓ Cadastro sem rolagem horizontal no celular e desktop')
 assert not errors,errors
 print('✓ Sem erros de JavaScript nos fluxos testados')
 (OUT/'result.json').write_text(json.dumps({'groups':5,'storage':'UI stub; crypto tested separately','errors':errors},indent=2))
 browser.close();print('Screenshots e resultados em',OUT)
