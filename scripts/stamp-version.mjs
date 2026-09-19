/* Propaga a versão do package.json para os dois projetos nativos.
 * Antes desta etapa o pacote trazia "versão 25" no app.js, v29 no service worker e
 * v24 na documentação. Agora existe uma origem só, e a build falha se ela divergir. */
import {readFileSync,writeFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const {version}=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
if(!/^\d+\.\d+\.\d+$/.test(version))throw Error(`Versão inválida para as lojas: ${version}`);

// versionCode precisa crescer a cada envio ao Google Play e ser um inteiro.
const [maj,min,patch]=version.split('.').map(Number);
const code=maj*10000+min*100+patch;

const gradlePath=join(root,'android','app','build.gradle');
let gradle=readFileSync(gradlePath,'utf8');
gradle=gradle.replace(/versionCode \d+/,`versionCode ${code}`).replace(/versionName "[^"]*"/,`versionName "${version}"`);
writeFileSync(gradlePath,gradle);

// No iOS a versão vive no projeto Xcode (MARKETING_VERSION), não no Info.plist.
const pbxPath=join(root,'ios','App','App.xcodeproj','project.pbxproj');
let pbx=readFileSync(pbxPath,'utf8');
pbx=pbx.replace(/MARKETING_VERSION = [^;]+;/g,`MARKETING_VERSION = ${version};`)
       .replace(/CURRENT_PROJECT_VERSION = [^;]+;/g,`CURRENT_PROJECT_VERSION = ${code};`);
writeFileSync(pbxPath,pbx);

console.log(`versão ${version} · versionCode/CURRENT_PROJECT_VERSION ${code} · Android + iOS`);
