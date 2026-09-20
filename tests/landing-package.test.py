"""Static integrity of the strategic landing and the separate app entry page."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
import re
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

R = Path(__file__).resolve().parents[1]


class HTML(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags = []

    def handle_starttag(self, tag, attrs):
        self.tags.append((tag, dict(attrs)))


def parse(name):
    parser = HTML()
    parser.feed((R / name).read_text(encoding='utf-8'))
    return parser.tags


count = 0


def ok(message):
    global count
    count += 1
    print('✓', message)


root = parse('index.html')
app = parse('app/index.html')
source = (R / 'index.html').read_text(encoding='utf-8')
css = (R / 'assets/landing/landing.css').read_text(encoding='utf-8')
app_js = (R / 'app.js').read_text(encoding='utf-8')
app_css = (R / 'styles.css').read_text(encoding='utf-8')
sw = (R / 'sw.js').read_text(encoding='utf-8')
cloud_js = (R / 'cloud.js').read_text(encoding='utf-8')

assert 'Independência<br>no trabalho.<br><span>Clareza no' in source
assert 'Inteligência financeira para autônomos' in source
assert 'R$ 29,90' in source and 'Pagamento único' in source
assert 'Não é sobre uma vida de luxo.' in source
ok('Conteúdo segue a proposta estratégica e mantém a oferta de pagamento único')

assert source.count('href="./app/"') == 3
assert 'Comprar' not in source and 'A compra ainda não está disponível' not in source
ok('Os três CTAs da home levam diretamente à tela de acesso do app')

for name, tags in [('index.html', root), ('app/index.html', app)]:
    for tag, attrs in tags:
        for ref in [attrs[key] for key in ('src', 'href') if key in attrs]:
            url = urlsplit(ref)
            if url.scheme or ref.startswith('#'):
                continue
            path = (R / name).parent / unquote(url.path)
            if path.is_dir():
                path = path / 'index.html'
            assert path.exists(), f'{name}: recurso ausente {ref}'
ok('Recursos locais da landing e do app resolvem corretamente')

ids = {attrs['id'] for _, attrs in root if 'id' in attrs}
for tag, attrs in root:
    if tag == 'a' and attrs.get('href', '').startswith('#'):
        assert attrs['href'][1:] in ids
ok('Todas as âncoras da nova home têm destino')

assert len([1 for tag, _ in root if tag == 'h1']) == 1
assert any(tag == 'main' for tag, _ in root)
assert any(tag == 'header' for tag, _ in root)
assert any(tag == 'footer' for tag, _ in root)
assert any(tag == 'details' and 'open' in attrs for tag, attrs in root)
ok('Home mantém landmarks, heading único e FAQ acessível sem depender de JavaScript')

assert not any(tag == 'img' for tag, _ in root)
assert 'financial-scene' in source and 'ledger' in source and 'chart' in source
assert '.financial-scene' in css and '.ledger' in css and '.chart' in css
assert not any(name in source for name in ('hero-night', 'night-table', 'golden-sea', 'life-lately-sunset'))
ok('Ilustração financeira é vetorial em HTML/CSS, sem fotografias ou assets remotos')

assert 'brand-symbol' in source and 'life lately<span class="brand-dot">.</span>' in source
assert 'll-brand-symbol' in app_js and 'll-brand-name' in app_js
assert '.ll-brand-symbol' in app_css and '.ll-brand-dot' in app_css
assert 'brand-wordmark' not in app_js and 'brand-full-wordmark' not in app_js
assert 'assets/brand/life-lately-logo.png' not in source and 'assets/brand/life-lately-logo.png' not in app_js
ok('Nova assinatura life lately. aparece na landing e nos pontos de marca do app')

assert all(term in source for term in ('ganhos', 'compromissos', 'cofrinhos', 'metas', 'despesas', 'renda variável'))
assert 'guardados no seu próprio navegador' in source
ok('Texto da proposta descreve apenas recursos e privacidade presentes no app atual')

core_js = (R / 'core.js').read_text(encoding='utf-8')
assert not re.search(r'd[ií]vidas?', source, re.I)
assert not re.search(r'd[ií]vidas?', app_js, re.I)
assert not re.search(r'd[ií]vidas?', core_js, re.I)
assert "['debts','debts','Compromissos']" in app_js
ok('Interface, mensagens do motor e landing usam Compromissos sem exibir o termo anterior')

assert '--bg:#f7f4ef' in app_css and '--rose:#61765f' in app_css and '--pink:#e8eee7' in app_css
assert 'Strategic Finance palette across access and app surfaces' in app_css
assert '<meta name="theme-color" content="#61765f">' in (R / 'app/index.html').read_text(encoding='utf-8')
ok('Login e app compartilham a paleta creme, grafite, sálvia e mauve da landing')

assert 'Entrar com Google' in app_js and 'Entrar com Apple' in app_js and 'Apenas conhecer' in app_js
assert '<form id="accessForm">' not in app_js
assert 'Criar acesso local' not in app_js and 'Entrar neste aparelho' not in app_js
assert '<span class="kicker">Um espaço só seu</span>' not in app_js
assert '<h1 style="margin-top:9px">Seu dinheiro.<br>Seus próximos planos.</h1>' not in app_js
assert '<p class="subtitle">Entre com Google ou conheça o app sem criar conta.</p>' not in app_js
assert '.provider-button.google{position:relative;grid-template-columns:1fr;text-align:center}' in app_css
assert 'googleEnabled:true' in cloud_js
assert 'sb_publishable_' in cloud_js and 'service_role' not in cloud_js.lower()
assert 'kgyztrybhrmsxzwpjntq.supabase.co' in cloud_js
assert 'vendor/supabase-2.116.0.js' in (R / 'app/index.html').read_text(encoding='utf-8')
ok('Acesso Google está ativo com chave publicável; Apple permanece desativado e o modo conhecer é local')

assert not re.search(r'(?:localStorage|indexedDB|LLStore|core\.js|storage\.js|(?<!/)app\.js)', source)
assert 'localStorage' not in (R / 'assets/landing/landing.js').read_text(encoding='utf-8')
ok('Landing não carrega nem lê o banco ou o motor financeiro')

storage = (R / 'storage.js').read_text(encoding='utf-8')
assert all(key in storage for key in ['lifeLatelyZeroV22Account', 'lifeLatelyZeroV22State', 'life-lately-zero-v22'])
ok('Namespace de armazenamento do app permanece presente')

assert not list(R.rglob('*.woff*')) and not list(R.rglob('*.ttf')) and not list(R.rglob('*.otf'))
assert 'family=Manrope' in source and 'family=Manrope' in (R / 'app/index.html').read_text(encoding='utf-8')
assert 'fonts.googleapis.com' in (R / '_headers').read_text(encoding='utf-8')
ok('Manrope é aplicada com fallback, sem adicionar binários de fonte ao projeto')

assert 'life-lately-v39-clean-access-20260920' in sw
assert 'assets/landing/landing.css' in sw and 'favicon-original.ico' in sw
assert 'cloud.js' in sw and 'vendor/supabase-2.116.0.js' in sw
assert not any(photo in sw for photo in ('hero-night', 'night-table', 'golden-sea', 'life-lately-sunset'))
assert not any(re.match(r'\s*/\*\s+', line) for line in (R / '_redirects').read_text(encoding='utf-8').splitlines())
ok('Precache v39 contém a nova home, cliente de nuvem e não redireciona rotas desconhecidas')

print(f'\n{count} verificações da landing concluídas.')
