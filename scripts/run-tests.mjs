/* Roda as suítes Node do motor e do armazenamento. As suítes Playwright (tests/*.py)
 * exigem navegador instalado e entram no CI separadamente — ver docs/publicacao/. */
import {readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const files=readdirSync(join(root,'tests')).filter(f=>f.endsWith('.test.cjs')).sort();
let failed=[];
for(const f of files){
 process.stdout.write(`\n\u2500\u2500 ${f}\n`);
 try{execFileSync(process.execPath,[join(root,'tests',f)],{stdio:'inherit'});}
 catch{failed.push(f);}
}
console.log(`\n${files.length-failed.length}/${files.length} su\u00edtes passaram.`);
if(failed.length){console.error('Falharam: '+failed.join(', '));process.exit(1);}
