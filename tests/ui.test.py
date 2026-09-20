from pathlib import Path
from playwright.sync_api import sync_playwright
import json,re,os,tempfile
R=Path(__file__).resolve().parents[1];O=Path(tempfile.mkdtemp(prefix='life-lately-ui-'))
html=(R/'app/index.html').read_text()
html=re.sub(r'<script[^>]*src="[^"]+"[^>]*></script>','',html)
html=re.sub(r'<link[^>]+>','',html)
html=html.replace('</head>','<meta name="ll-preview" content="true"><style>'+(R/'styles.css').read_text()+'</style></head>')

results=[]
def ok(name):
 results.append(name);print('✓',name)
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path=os.environ.get('LL_BROWSER_PATH') or None,headless=True,args=['--no-sandbox'])
 ctx=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
 p=ctx.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
 p.set_content(html)
 p.add_script_tag(content="if(!crypto.subtle)Object.defineProperty(crypto,'subtle',{value:{},configurable:true});")
 for name in ['core.js','storage.js']:p.add_script_tag(content=(R/name).read_text())
 p.add_script_tag(content='window.QAFailSave=false;window.LLStore={...LLStore,save:async s=>{if(QAFailSave)throw Error("Falha simulada de gravação");window.QAState=structuredClone(s);},isUnlocked:()=>true};')
 p.add_script_tag(content=(R/'app.js').read_text());p.evaluate('document.dispatchEvent(new Event("DOMContentLoaded"))')
 assert p.locator('#accessForm').count()==0
 assert p.locator('.provider-stack button').count()==3
 ok('Tela de acesso mantém somente Google, Apple e conhecer')
 p.evaluate('''const qa=LL.empty();qa.profile.name='Teste';const qaDate=LL.afterMonths(1);LL.upsertPocket(qa,{label:'Aluguel',targetAmount:400,targetDate:qaDate});LL.upsertPocket(qa,{label:'Luz',targetAmount:30,targetDate:qaDate});LL.upsertDebt(qa,{name:'Dívida',total:40,due:qaDate});LL.income(qa,{value:100,description:'Diária'});showUnlocked(qa,false);''')
 get=lambda expr:p.evaluate(expr)
 close=lambda:p.keyboard.press('Escape')
 def nav(id):p.evaluate('(id)=>showPage(id)',id)
 def waitclosed():p.wait_for_function('!document.getElementById("dialog").open')
 def fill(sel,v):p.locator(sel).fill(v)
 ids=get('Object.fromEntries(state.allocationCategories.map(c=>[c.label,c.id]))');debtid=get('state.debts[0].id')
 # Entire debt card, payment using linked envelope.
 nav('debts');p.locator('#view .debt-card').click()
 p.locator('[data-action=debt-tab][data-tab=partial]').click();fill('#payForm [name=amount]','5');p.locator('#payForm [type=submit]').click();waitclosed()
 assert get('LL.debtBalance(state,state.debts[0])')==35
 assert get('LL.pocket(state,state.debts[0].pocketId)')==3.51
 assert get('LL.summary(state).lifetimeIncome')==100
 ok('Card de dívida abre o modal; pagamento atualiza dívida e cofrinho correto')
 nav('organize');p.locator(f'#view [data-action=pocket][data-id="{ids["Aluguel"]}"]').click()
 p.locator('#dialog [data-action=pocket-move]').click();fill('#moveForm [name=amount]','10')
 p.locator('#moveForm [type=submit]').click();p.wait_for_selector('#dialog [data-action=pocket-move]')
 assert get(f'LL.pocket(state,"{ids["Aluguel"]}")')==75.11
 assert get('LL.summary(state).lifetimeIncome')==100
 ok('Uso do cofrinho não reduz renda histórica')
 p.locator('#dialog [data-action=pocket-move]').click();p.locator('#moveType').select_option('transfer')
 fill('#moveForm [name=amount]','2');p.locator('#moveDestination').select_option(ids['Luz'])
 p.locator('#moveForm [type=submit]').click();p.wait_for_selector('#dialog [data-action=pocket-move]')
 assert get('LL.summary(state).pockets')==85
 assert get(f'LL.pocketStats(state,"{ids["Aluguel"]}").spent')==10
 ok('Transferência entre cofrinhos conserva saldo total e não vira gasto')
 p.locator('#dialog [data-action=pocket-move]').click();p.locator('#moveType').select_option('deposit')
 fill('#moveForm [name=amount]','1,5');p.locator('#moveForm [name=amount]').blur()
 assert p.locator('#moveForm [name=amount]').input_value()=='1,50'
 p.locator('#moveForm [type=submit]').click();p.wait_for_selector('#dialog [data-action=pocket-move]')
 assert get('LL.summary(state).pockets')==86.5
 ok('Entrada de fora e máscara monetária com centavos')
 p.locator('#dialog [data-action=pocket-move]').click();p.locator('#moveType').select_option('adjustment');fill('#moveForm [name=amount]','70')
 p.locator('#moveForm [type=submit]').click();p.wait_for_selector('#dialog [data-action=pocket-move]')
 assert get(f'LL.pocket(state,"{ids["Aluguel"]}")')==70
 assert get('LL.summary(state).lifetimeIncome')==100
 close();ok('Ajustar saldo cria movimentação sem sobrescrever os ganhos')
 # Long horizon goal; clicking the goal itself edits it.
 nav('goals');p.locator('#view [data-action=new-goal]').first.click()
 fill('#pocketForm [name=label]','Viagem daqui a 30 anos');fill('#pocketForm [name=target]','500')
 p.locator('[data-action=date-shortcut][data-id="360"]').click();future=p.locator('[name=targetDate]').input_value()
 p.locator('#pocketForm [type=submit]').click();waitclosed()
 p.locator('#view [data-action=goal-open]').click();assert p.locator('#pocketForm [name=targetDate]').input_value()==future
 fill('#pocketForm [name=target]','600');p.locator('#pocketForm [type=submit]').click();waitclosed()
 assert get('LL.cats(state).find(c=>c.role==="goal").targetAmount')==600
 nav('organize');assert p.locator('#view .pocket-card',has_text='Viagem daqui a 30 anos').count()==1
 ok('Criar meta, prazo de 30 anos e edição pelo card compartilham o mesmo cofrinho')
 # Manual percentages, native drag & no rebuilding of nodes.
 p.locator('#view [data-action=allocation]').click();p.locator('[data-action=allocation-mode][data-id=manual]').click()
 nodes=p.locator('#allocationForm [data-pct-number]');nodes.first.fill('5')
 assert p.locator('#allocationForm [type=submit]').is_disabled()
 p.evaluate('window.QASlider=document.querySelector("[data-slider]")')
 slider=p.locator('[data-slider]').first;slider.scroll_into_view_if_needed();box=slider.bounding_box();y=box['y']+box['height']/2
 p.mouse.move(box['x']+5,y);p.mouse.down();p.mouse.move(box['x']+box['width']*.3,y,steps=8);v1=slider.input_value();p.mouse.move(box['x']+box['width']*.6,y,steps=8);v2=slider.input_value();p.mouse.up()
 assert v1!=v2
 assert get('QASlider===document.querySelector("[data-slider]")')
 ok('Arraste contínuo preserva o elemento slider e atualiza o total em tempo real')
 # Native touch on same range: verifies continuous motion in Chromium emulation.
 slider.scroll_into_view_if_needed();box=slider.bounding_box();y=box['y']+box['height']/2
 cdp=ctx.new_cdp_session(p)
 cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':box['x']+40,'y':y}]})
 for frac in [.2,.35,.5,.75]:cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':box['x']+box['width']*frac,'y':y}]})
 cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
 assert float(slider.input_value())>65
 ok('Slider responde a gesto de toque em navegador com emulação móvel')
 for el in nodes.all():el.fill('0')
 p.locator(f'[data-pct-number="{ids["Aluguel"]}"]').fill('70')
 p.locator(f'[data-pct-number="{ids["Luz"]}"]').fill('20')
 assert '90%' in p.locator('#manualPct').inner_text();assert p.locator('#allocationForm [type=submit]').is_disabled()
 p.locator('[data-pct-number=livre]').fill('10');assert not p.locator('#allocationForm [type=submit]').is_disabled()
 p.locator('#allocationForm [type=submit]').click();waitclosed();assert get('state.preferences.allocationMode')=='manual'
 ok('Modo manual soma 90/100 de forma independente e só salva 100%')
 # Failed persistence must not mutate the UI domain state.
 nav('income');p.locator('#view [data-action=new-income]').first.click();fill('#incomeForm [name=amount]','10')
 p.evaluate('QAFailSave=true');p.locator('#incomeForm [type=submit]').click();p.wait_for_selector('#dialogError:not([hidden])')
 assert get('state.transactions.length')==1
 assert not p.locator('#incomeForm [type=submit]').is_disabled()
 p.evaluate('QAFailSave=false');p.locator('#incomeForm [name=distribute]').uncheck()
 p.locator('#incomeForm [type=submit]').click();waitclosed();assert get('LL.pendingCents(state)')==1000
 ok('Falha ao salvar mostra erro e não altera estado; ganho pendente pode ser registrado')
 p.locator('#view [data-action=apply]').first.click();p.locator('#applyForm [type=submit]').click();p.wait_for_selector('.receipt');close()
 assert get('LL.pendingCents(state)')==0;before=get('LL.summary(state).pockets')
 p.evaluate('openApply()');assert get('LL.summary(state).pockets')==before
 ok('Aplicar divisão tem confirmação e não duplica ganhos já separados')
 nav('settings');p.locator('#view [data-action=currency]').click();p.locator('#currencySelect').select_option('CNY')
 p.locator('[name=confirmCurrency]').check();p.locator('#currencyForm [type=submit]').click();waitclosed()
 nav('income');p.locator('#view [data-action=new-income]').first.click();assert p.locator('.money-prefix').inner_text()=='CN¥'
 fill('#incomeForm [name=amount]','-10');p.locator('#incomeForm [type=submit]').click();p.wait_for_selector('#dialogError:not([hidden])');assert get('state.transactions.length')==2
 close();ok('Moeda chinesa global e valores negativos recusados sem perder o histórico')
 nav('settings');p.locator('#view [data-action=help]').click()
 for i in range(15):
  p.keyboard.press('Tab');assert get('document.querySelector("#dialog").contains(document.activeElement)')
 p.locator('[data-action=modal-back]').click();assert not get('document.querySelector("#dialog").open')
 p.locator('#view [data-action=profile]').click();p.keyboard.press('Escape');assert not get('document.querySelector("#dialog").open')
 ok('Modal retém o foco, fecha com Escape e navega de volta sem sobrepor a tela')
 # Render every screen and long modal at phone, tablet and desktop widths.
 metrics=[]
 for width in [320,375,390,768,1024,1440]:
  p.set_viewport_size({'width':width,'height':900})
  for view in ['overview','income','organize','goals','debts','settings']:
   nav(view)
   size=get('({s:document.documentElement.scrollWidth,w:innerWidth})');assert size['s']<=size['w'],(width,view,size)
   metrics.append({'width':width,'screen':view,'overflow':False})
  p.evaluate('openIncome()');fill('#incomeForm [name=amount]','1234567,89')
  size=get('({s:document.getElementById("dialog").scrollWidth,w:document.getElementById("dialog").clientWidth})')
  assert size['s']<=size['w']+1,(width,'modal',size)
  close()
 ok('36 combinações tela/largura e 6 modais sem rolagem horizontal')
 assert not errors,errors
 ok('Nenhum erro de JavaScript nas interações exercitadas')
 (O/'ui-results.json').write_text(json.dumps({'checks':results,'viewports':metrics,'browserErrors':errors,'storage':'stub, only for these browser UI tests'},ensure_ascii=False,indent=2))
 browser.close();print(f'\n{len(results)} grupos de verificações de UI concluídos.')
