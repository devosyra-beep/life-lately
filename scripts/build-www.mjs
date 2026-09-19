/* Monta www/ — a raiz web que o Capacitor empacota dentro do app nativo.
 *
 * O app nativo NÃO leva a landing nem o service worker: os arquivos já vivem no
 * bundle, então não existe "primeira abertura precisa de internet" e não existe
 * cache a invalidar. A landing continua sendo publicada como site, do jeito que é.
 *
 * Nada aqui compila ou transpila: é cópia + reescrita de caminhos relativos,
 * para que o mesmo código-fonte sirva ao site e aos dois aplicativos.
 */
import {readFileSync,writeFileSync,rmSync,mkdirSync,cpSync,existsSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const out=join(root,'www');
const pkg=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));

const COPY=['core.js','storage.js','app.js','styles.css'];

rmSync(out,{recursive:true,force:true});
mkdirSync(out,{recursive:true});

for(const f of COPY){
 if(!existsSync(join(root,f)))throw Error(`Arquivo de origem ausente: ${f}`);
 cpSync(join(root,f),join(out,f));
}
cpSync(join(root,'icons'),join(out,'icons'),{recursive:true});

// A casca do app vira a raiz: ../ deixa de fazer sentido dentro do bundle.
let html=readFileSync(join(root,'app','index.html'),'utf8');
html=html.replaceAll('"../','"./');
if(html.includes('"../'))throw Error('Sobrou um caminho ../ no HTML do app.');

// platform.js precisa existir antes de app.js; defer preserva a ordem de declaração.
html=html.replace('<script defer src="./core.js"></script>','<script defer src="./platform.js"></script>\n<script defer src="./core.js"></script>');
if(!html.includes('platform.js'))throw Error('Não foi possível injetar platform.js.');
writeFileSync(join(out,'index.html'),html);

// Manifesto próprio do bundle: start_url é a raiz do www, não /app/.
const manifest=JSON.parse(readFileSync(join(root,'manifest.webmanifest'),'utf8'));
writeFileSync(join(out,'manifest.webmanifest'),JSON.stringify({...manifest,start_url:'./',scope:'./',id:'/'},null,2));

// Uma única fonte de verdade para a versão, consumida pela tela de Configurações
// e, mais tarde, pelo versionName do Android e pelo CFBundleShortVersionString do iOS.
writeFileSync(join(out,'platform.js'),`/* Gerado por scripts/build-www.mjs — não editar à mão. */
(function(root){
 'use strict';
 const cap=root.Capacitor;
 const native=!!(cap&&typeof cap.isNativePlatform==='function'&&cap.isNativePlatform());
 root.LLPlatform={
  version:${JSON.stringify(pkg.version)},
  bundled:true, // www/ nunca embarca sw.js: os arquivos ja vivem no bundle
  native,
  platform:native?cap.getPlatform():'web',
  ios:native&&cap.getPlatform()==='ios',
  android:native&&cap.getPlatform()==='android'
 };
})(globalThis);
`);

console.log(`www/ montado · versão ${pkg.version} · ${COPY.length+3} arquivos + ícones`);
