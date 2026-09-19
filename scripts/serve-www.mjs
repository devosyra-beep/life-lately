/* Serve www/ em http://localhost:8000 para conferir o bundle antes de sincronizar.
 * localhost é secure context, então crypto.subtle e IndexedDB funcionam como no app. */
import {createServer} from 'node:http';
import {readFileSync,existsSync,statSync} from 'node:fs';
import {join,extname,dirname,normalize} from 'node:path';
import {fileURLToPath} from 'node:url';

const www=join(dirname(fileURLToPath(import.meta.url)),'..','www');
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.webmanifest':'application/manifest+json'};
createServer((req,res)=>{
 const rel=normalize(decodeURIComponent(new URL(req.url,'http://x').pathname)).replace(/^[/]+/,'');
 let file=join(www,rel);
 if(!file.startsWith(www)){res.writeHead(403).end('Forbidden');return;}
 if(existsSync(file)&&statSync(file).isDirectory())file=join(www,'index.html');
 if(!existsSync(file)){res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'}).end('404');return;}
 res.writeHead(200,{'Content-Type':TYPES[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
 res.end(readFileSync(file));
}).listen(8000,()=>console.log('www/ em http://localhost:8000'));
