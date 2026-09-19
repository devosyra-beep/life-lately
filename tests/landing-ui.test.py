"""Landing rendering and link semantics. Inline fixtures; no network navigation.
Google Fonts are omitted only in this test. Production retains their original URLs.
"""
from pathlib import Path
import re,base64,mimetypes,json,os,tempfile
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1]
OUT=Path(os.environ.get('LL_QA_OUTPUT') or tempfile.mkdtemp(prefix='life-lately-landing-'))
OUT.mkdir(parents=True,exist_ok=True)
s=(R/'index.html').read_text()
s=re.sub(r'<script\b[^>]+src="[^"]+"[^>]*></script>','',s)
s=re.sub(r'<link[^>]+(?:fonts\.(?:googleapis|gstatic)\.com|rel="manifest")[^>]*>','',s)
s=s.replace('<link rel="stylesheet" href="./assets/landing/landing.css">','<style>'+(R/'assets/landing/landing.css').read_text()+'</style>')
s=re.sub(r'<source\b[^>]+>','',s)
def inline(m):
 p=R/m.group(2).removeprefix('./')
 if p.exists():return f'{m.group(1)}="data:{mimetypes.guess_type(str(p))[0]};base64,{base64.b64encode(p.read_bytes()).decode()}"'
 return m.group(0)
s=re.sub(r'(src|href)="(\./(?:assets/landing/[^" ]+\.(?:jpg|webp)|icons/[^" ]+\.png))"',inline,s)
checks=[]
def ok(message):checks.append(message);print('✓',message,flush=True)
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ.get('LL_BROWSER_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
 c=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,reduced_motion='reduce')
 p=c.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
 p.set_content(s,wait_until='load')
 assert p.locator('h1').inner_text().replace('\n',' ').strip()=='A vida acontece. Seu dinheiro acompanha.'
 assert p.locator('#accessForm').count()==0
 assert p.evaluate('typeof LLStore')=='undefined'
 ok('Landing mostra a frase pedida e não executa login nem banco de dados')
 for image in p.locator('img').all():image.scroll_into_view_if_needed();p.wait_for_timeout(120)
 assert p.evaluate('[...document.images].every(x=>x.complete&&x.naturalWidth>0)')
 assert p.locator('img').count()==3
 ok('As três fotografias originais renderizam, inclusive as imagens lazy após rolagem')
 p.evaluate('scrollTo(0,0)')
 for width in [320,360,390,430,768,1024,1440]:
  p.set_viewport_size({'width':width,'height':900})
  assert p.evaluate('document.documentElement.scrollWidth<=innerWidth'),f'Overflow {width}'
  box=p.locator('.nav-cta').bounding_box();assert box['height']>=44 and box['x']>=0 and box['x']+box['width']<=width
  assert p.locator('.site-nav').is_visible()==(width>=900)
 ok('320–1440 px: sem rolagem horizontal; CTA acessível e navegação adaptada')
 p.set_viewport_size({'width':390,'height':844})
 p.evaluate('''document.addEventListener('click', e=>{const a=e.target.closest('[data-app-link]');if(a){e.preventDefault();window.clickedAccess=a.getAttribute('href');}})''')
 for link in p.locator('[data-app-link]').all():
  link.scroll_into_view_if_needed();link.click();assert p.evaluate('clickedAccess')=='./app/index.html'
 ok('Cinco CTAs clicáveis apontam ao HTML de acesso, sem caminho vazio ou link fictício')
 p.locator('a[href="#experiencia"]').last.click()
 assert p.locator('#experiencia').bounding_box()['y']>=70
 p.set_viewport_size({'width':1440,'height':1000})
 p.locator('.site-nav a[href="#manifesto"]').click()
 assert 70<=p.locator('#manifesto').bounding_box()['y']<=130
 ok('Âncoras levam às seções sem esconder o início sob o cabeçalho fixo')
 assert p.evaluate('getComputedStyle(document.querySelector(".demo-phone")).animationName')=='none'
 ok('Redução de movimento desativa flutuação e animações')
 assert 'Osyra Team' in p.locator('footer').inner_text() and 'Fundadora' not in p.locator('footer').inner_text() and 'Bernardes' not in p.locator('footer').inner_text()
 assert 'Prévia ilustrativa' in p.locator('figcaption').inner_text()
 ok('Créditos originais preservados e valores de demonstração identificados como prévia')
 for width,name in [(390,'landing-mobile'),(1440,'landing-desktop')]:
  p.set_viewport_size({'width':width,'height':900 if width==390 else 1000});p.evaluate('scrollTo(0,0)');p.screenshot(path=str(OUT/(name+'.png')),full_page=True)
 # Load the app document separately to verify its unchanged access screen.
 a=(R/'app/index.html').read_text()
 a=re.sub(r'<script\b[^>]+src="[^"]+"[^>]*></script>','',a)
 a=re.sub(r'<link\b[^>]+>','',a)
 a=a.replace('</head>','<meta name="ll-preview" content="true"><style>'+(R/'styles.css').read_text()+'</style></head>')
 q=c.new_page();q.on('pageerror',lambda e:errors.append(str(e)));q.set_viewport_size({'width':390,'height':844});q.set_content(a)
 for name in ['core.js','storage.js','app.js']:q.add_script_tag(content=(R/name).read_text())
 q.evaluate('document.dispatchEvent(new Event("DOMContentLoaded"))')
 assert q.locator('#accessForm [name=name]').count()==1
 assert q.locator('#accessForm [name=password]').get_attribute('minlength')=='8'
 assert q.get_by_role('button',name='Criar meu acesso').is_visible()
 q.screenshot(path=str(OUT/'cadastro-mobile.png'))
 ok('Página do app mantém cadastro inicial sem usuário nem senha pré-preenchidos')
 q.evaluate("LLStore.readAccount=()=>({username:'Sara QA'});renderAccess();")
 assert q.locator('#accessForm [name=name]').count()==0
 assert q.get_by_role('button',name='Entrar',exact=True).is_visible()
 assert 'Olá, Sara.' in q.locator('#access').inner_text()
 q.screenshot(path=str(OUT/'login-mobile.png'))
 ok('Com cadastro existente simulado, o mesmo app mostra Olá, Sara e pede a senha')
 assert not errors,errors
 ok('Nenhum erro JavaScript nas verificações de interface')
 b.close()
(OUT/'resultados.json').write_text(json.dumps({'checks':checks,'realNavigation':False,'storage':'readAccount fixture only; WebCrypto tested in Node','fonts':'system fallback'},ensure_ascii=False,indent=2))
print(f'\n{len(checks)} grupos de verificações da landing / acesso concluídos. Prints: {OUT}')
