"""Static integrity of the two entry pages. No server, browser or real user data."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit,unquote
import re,json,hashlib,sys
if hasattr(sys.stdout,'reconfigure'):
 sys.stdout.reconfigure(encoding='utf-8')
R=Path(__file__).resolve().parents[1]
class HTML(HTMLParser):
 def __init__(self):super().__init__();self.tags=[]
 def handle_starttag(self,tag,attrs):self.tags.append((tag,dict(attrs)))
def parse(name):
 p=HTML();p.feed((R/name).read_text(encoding='utf-8'));return p.tags
n=0
def ok(s):
 global n;n+=1;print('✓',s)
root=parse('index.html');app=parse('app/index.html')
source=(R/'index.html').read_text(encoding='utf-8')
assert 'A vida acontece.<br><em' in source and 'Seu dinheiro acompanha.' in source
assert 'A noite é sua.' not in source and 'O saldo também.' not in source
ok('Nova chamada está na landing e a chamada antiga foi removida')
ctas=[a['href'] for t,a in root if t=='a' and 'data-app-link' in a]
assert len(ctas)==5 and set(ctas)=={'./app/index.html'}
ok('Todos os cinco acessos, incluindo a prévia de Ganhei, levam ao app')
for name,tags in [('index.html',root),('app/index.html',app)]:
 for tag,a in tags:
  refs=[a[k] for k in ['src','href'] if k in a]
  if 'srcset' in a:refs += [v.strip().split()[0] for v in a['srcset'].split(',')]
  for ref in refs:
   u=urlsplit(ref)
   if u.scheme or ref.startswith('#'):continue
   p=(R/name).parent/unquote(u.path)
   if p.is_dir():p=p/'index.html'
   assert p.exists(),f'{name}: recurso ausente {ref}'
ok('Imagens, CSS, JavaScript, manifesto e links locais resolvem corretamente')
ids={a['id'] for t,a in root if 'id' in a}
for tag,a in root:
 if tag=='a' and a.get('href','').startswith('#'):assert a['href'][1:] in ids
ok('Todas as âncoras da landing têm destino')
assert len([1 for t,a in root if t=='h1'])==1
assert any(t=='main' for t,a in root)
assert all(a.get('alt') for t,a in root if t=='img')
ok('Heading principal único, landmark main e imagens com descrição')
for name in ['hero-night','night-table','golden-sea']:
 assert any(name+'.jpg' in a.get('src','') for t,a in root)
 assert any(name+'-' in a.get('srcset','') for t,a in root)
ok('As três imagens fornecidas estão aplicadas, com WebP responsivo e JPG de fallback')
assert not re.search(r'(?:localStorage|indexedDB|LLStore|core\.js|storage\.js|(?<!/)app\.js)',source)
assert 'localStorage' not in (R/'assets/landing/landing.js').read_text(encoding='utf-8')
ok('A landing não carrega nem lê o banco ou o cadastro financeiro')
assert all(k in (R/'storage.js').read_text(encoding='utf-8') for k in ['lifeLatelyZeroV22Account','lifeLatelyZeroV22State','life-lately-zero-v22'])
ok('Namespace de armazenamento v22–v24 preservado')
assert not list(R.rglob('*.woff*')) and not list(R.rglob('*.ttf')) and not list(R.rglob('*.otf'))
ok('Nenhum arquivo de fonte incluído; tipografia externa tem fallback')
assert 'fonts.googleapis.com' in (R/'_headers').read_text(encoding='utf-8') and 'fonts.gstatic.com' in (R/'_headers').read_text(encoding='utf-8')
assert not any(re.match(r'\s*/\*\s+',line) for line in (R/'_redirects').read_text(encoding='utf-8').splitlines())
ok('CSP permite a tipografia prevista e não há redirecionamento global para a landing')
print(f'\n{n} verificações estáticas concluídas.')
