"""Landing rendering, responsive layout, CTA semantics and app brand smoke test.
Google Fonts are omitted only in this fixture; production retains their URLs.
"""
from pathlib import Path
import re, json, os, tempfile
from playwright.sync_api import sync_playwright

R = Path(__file__).resolve().parents[1]
OUT = Path(os.environ.get('LL_QA_OUTPUT') or tempfile.mkdtemp(prefix='life-lately-landing-'))
OUT.mkdir(parents=True, exist_ok=True)

s = (R / 'index.html').read_text(encoding='utf-8')
s = re.sub(r'<script\b[^>]+src="[^"]+"[^>]*></script>', '', s)
s = re.sub(r'<link[^>]+(?:fonts\.(?:googleapis|gstatic)\.com|rel="manifest")[^>]*>', '', s)
s = s.replace('<link rel="stylesheet" href="./assets/landing/landing.css">', '<style>' + (R / 'assets/landing/landing.css').read_text(encoding='utf-8') + '</style>')

checks = []
def ok(message):
    checks.append(message)
    print('✓', message, flush=True)

with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=os.environ.get('LL_BROWSER_PATH', '/usr/bin/chromium'), headless=True, args=['--no-sandbox'])
    context = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, reduced_motion='reduce')
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.set_content(s, wait_until='load')

    assert page.locator('h1').inner_text().replace('\n', ' ').strip() == 'Independência no trabalho. Clareza no dinheiro.'
    assert page.locator('#accessForm').count() == 0
    assert page.evaluate('typeof LLStore') == 'undefined'
    assert page.locator('.financial-scene').is_visible()
    ok('Landing mostra a nova proposta e não executa login nem banco de dados')

    for width in [320, 360, 390, 430, 700, 768, 1024, 1440]:
        page.set_viewport_size({'width': width, 'height': 900})
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), f'Overflow {width}'
        box = page.locator('.nav-cta').bounding_box()
        assert box['height'] >= 39 and box['x'] >= 0 and box['x'] + box['width'] <= width
        assert page.locator('.site-header nav').is_visible() == (width > 700)
    ok('320–1440 px: sem rolagem horizontal; CTA e navegação se adaptam')

    page.set_viewport_size({'width': 390, 'height': 844})
    page.evaluate("""document.addEventListener('click', e => { const a=e.target.closest('a[href="./app/"]'); if(a){e.preventDefault();window.clickedAccess=a.getAttribute('href');} })""")
    links = page.locator('a[href="./app/"]')
    assert links.count() == 3
    for link in links.all():
        link.scroll_into_view_if_needed()
        link.click()
        assert page.evaluate('clickedAccess') == './app/'
    ok('Três CTAs clicáveis apontam para a tela de acesso')

    second = page.locator('.faq-item').nth(1)
    assert not second.get_attribute('open')
    second.locator('summary').click()
    assert second.get_attribute('open') is not None
    assert 'conhecer suas despesas' in second.locator('p').inner_text()
    ok('FAQ funciona de forma nativa e acessível, sem JavaScript próprio')

    for width, name in [(390, 'landing-mobile'), (1440, 'landing-desktop')]:
        page.set_viewport_size({'width': width, 'height': 900 if width == 390 else 1000})
        page.evaluate('scrollTo(0,0)')
        page.screenshot(path=str(OUT / (name + '.png')), full_page=True)

    app = (R / 'app/index.html').read_text(encoding='utf-8')
    app = re.sub(r'<script\b[^>]+src="[^"]+"[^>]*></script>', '', app)
    app = re.sub(r'<link\b[^>]+>', '', app)
    app = app.replace('</head>', '<meta name="ll-preview" content="true"><style>' + (R / 'styles.css').read_text(encoding='utf-8') + '</style></head>')
    access = context.new_page()
    access.on('pageerror', lambda e: errors.append(str(e)))
    access.set_viewport_size({'width': 390, 'height': 844})
    access.set_content(app)
    access.add_script_tag(content="if(!crypto.subtle)Object.defineProperty(crypto,'subtle',{value:{},configurable:true});")
    for name in ['core.js', 'storage.js']:
        access.add_script_tag(content=(R / name).read_text(encoding='utf-8'))
    access.add_script_tag(content="window.LLCloud={init:async()=>({available:true,session:null}),session:()=>null,settings:()=>({googleEnabled:true})};")
    access.add_script_tag(content=(R / 'app.js').read_text(encoding='utf-8'))
    access.evaluate('document.dispatchEvent(new Event("DOMContentLoaded"))')
    assert access.locator('.ll-brand-symbol').is_visible()
    assert access.locator('.ll-brand-name').inner_text() == 'life lately.'
    assert access.locator('#accessForm').count() == 0
    assert access.locator('.provider-stack button').count() == 3
    google_button = access.get_by_role('button', name=re.compile('Entrar com Google'))
    assert google_button.is_visible()
    button_box = google_button.bounding_box()
    label_box = google_button.locator('span').nth(1).bounding_box()
    assert abs((button_box['x'] + button_box['width'] / 2) - (label_box['x'] + label_box['width'] / 2)) <= 1
    assert access.get_by_role('button', name=re.compile('Entrar com Apple')).is_disabled()
    assert access.get_by_role('button', name=re.compile('Apenas conhecer')).is_visible()
    access.screenshot(path=str(OUT / 'cadastro-mobile.png'))
    ok('Tela inicial do app recebeu a mesma nova assinatura visual')

    access.get_by_role('button', name=re.compile('Apenas conhecer')).click()
    access.wait_for_function('accessMode === "guest" && state !== null')
    access.evaluate('showPage("settings")')
    assert 'Dados temporários desta visita' in access.locator('#view').inner_text()
    access.evaluate('lock()')
    access.wait_for_selector('.provider-stack')
    ok('Apenas conhecer abre uma sessão temporária e retorna sem criar cadastro')

    access.evaluate("LLStore.readAccount=()=>({username:'Sara QA'});renderAccess();")
    assert access.locator('#accessForm').count() == 0
    assert access.locator('.provider-stack button').count() == 3
    assert 'Sara QA' not in access.locator('#access').inner_text()
    access.screenshot(path=str(OUT / 'login-mobile.png'))
    ok('A tela mantém somente três opções mesmo quando há cadastro local antigo')

    assert not errors, errors
    ok('Nenhum erro JavaScript nas verificações de interface')
    browser.close()

(OUT / 'resultados.json').write_text(json.dumps({'checks': checks, 'realNavigation': False, 'storage': 'readAccount fixture only', 'fonts': 'system fallback'}, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'\n{len(checks)} grupos de verificações da landing / acesso concluídos. Prints: {OUT}')
