"""Static integrity of the production landing and the untouched app entry page."""
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

assert 'A vida acontece.<br><span>Seu dinheiro acompanha.</span>' in source
assert 'Planejamento financeiro para quem trabalha por conta própria' in source
assert 'R$ 29,90' in source and 'Sem mensalidade. Sem recorrência.' in source
assert 'a vida acontece à noite' not in source
ok('Texto da landing segue o layout Golden Hour e a promessa de compra única')

assert source.count('href="./app/"') == 4
assert 'Comprar' not in source
ok('CTAs da home usam Conhecer e levam à tela de acesso do app')

for name, tags in [('index.html', root), ('app/index.html', app)]:
    for tag, attrs in tags:
        refs = [attrs[key] for key in ('src', 'href') if key in attrs]
        for ref in refs:
            url = urlsplit(ref)
            if url.scheme or ref.startswith('#'):
                continue
            path = (R / name).parent / unquote(url.path)
            if path.is_dir():
                path = path / 'index.html'
            assert path.exists(), f'{name}: recurso ausente {ref}'
ok('Recursos locais da landing e do app resolvem corretamente')

ids = {attrs['id'] for tag, attrs in root if 'id' in attrs}
for tag, attrs in root:
    if tag == 'a' and attrs.get('href', '').startswith('#'):
        assert attrs['href'][1:] in ids
ok('Todas as âncoras da nova home têm destino')

assert len([1 for tag, _ in root if tag == 'h1']) == 1
assert any(tag == 'main' for tag, _ in root)
assert all(attrs.get('alt') for tag, attrs in root if tag == 'img')
ok('Home mobile-first mantém heading principal, landmark e texto alternativo')

assert any('life-lately-sunset.jpg' in attrs.get('src', '') for tag, attrs in root)
assert (R / 'assets/landing/life-lately-sunset.jpg').exists()
assert not any(name in source for name in ('hero-night', 'night-table', 'golden-sea'))
ok('A nova imagem de entardecer é a única foto usada pela home')

assert 'class="golden-wordmark">Life Lately</span>' in source
app_js = (R / 'app.js').read_text(encoding='utf-8')
assert 'brand-wordmark' in app_js and 'brand-full-wordmark' in app_js
assert 'assets/brand/life-lately-logo.png' not in source and 'assets/brand/life-lately-logo.png' not in app_js
ok('A marca usa apenas o wordmark textual na landing e no app')

assert not re.search(r'(?:localStorage|indexedDB|LLStore|core\.js|storage\.js|(?<!/)app\.js)', source)
assert 'localStorage' not in (R / 'assets/landing/landing.js').read_text(encoding='utf-8')
ok('A landing não carrega nem lê o banco ou o motor financeiro')

assert all(key in (R / 'storage.js').read_text(encoding='utf-8') for key in ['lifeLatelyZeroV22Account', 'lifeLatelyZeroV22State', 'life-lately-zero-v22'])
ok('O namespace de armazenamento do app permanece presente')

assert not list(R.rglob('*.woff*')) and not list(R.rglob('*.ttf')) and not list(R.rglob('*.otf'))
assert 'fonts.googleapis.com' in (R / '_headers').read_text(encoding='utf-8')
ok('Tipografia continua externa com fallback e sem novos arquivos de fonte')

assert 'life-lately-sunset.jpg' in (R / 'sw.js').read_text(encoding='utf-8')
assert 'assets/brand/life-lately-logo.png' not in (R / 'sw.js').read_text(encoding='utf-8')
assert not any(re.match(r'\s*/\*\s+', line) for line in (R / '_redirects').read_text(encoding='utf-8').splitlines())
ok('A imagem nova está no precache e não há redirecionamento global para a home')

print(f'\n{count} verificações da landing concluídas.')
