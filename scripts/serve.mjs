// Static files ONLY. No RPC proxy, wallet secrets, signing, uploads, or POST routes.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
const root=new URL('../dist/',import.meta.url),port=8787;
const files={'/':['index.html','text/html'],'/index.html':['index.html','text/html'],'/app.js':['app.js','text/javascript'],'/style.css':['style.css','text/css']};
const server=http.createServer(async(req,res)=>{
 if(!['127.0.0.1:'+port,'localhost:'+port].includes(req.headers.host)||!['GET','HEAD'].includes(req.method)){res.writeHead(403);res.end('Forbidden');return;}
 const file=files[(req.url||'').split('?')[0]];if(!file){res.writeHead(404);res.end('Not found');return;}
 try{const body=await readFile(new URL(file[0],root));res.writeHead(200,{'Content-Type':file[1]+'; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src https:; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});res.end(req.method==='HEAD'?undefined:body);}catch{res.writeHead(500);res.end('Missing bundle. Use the prebuilt release or run npm run build.');}
});
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'A local viewer is already using port 8787. Close its old launcher window, then open this launcher again.':'Cannot start local viewer: '+e.code);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>{
 const url='http://127.0.0.1:8787';
 console.log('SAGE Local is ready: '+url+'\nUse Chrome or Edge with Phantom. Close this window when finished.');
 if(process.argv.includes('--open')){
  const command=process.platform==='win32'?['rundll32.exe',['url.dll,FileProtocolHandler',url]]:process.platform==='darwin'?['open',[url]]:['xdg-open',[url]];
  execFile(command[0],command[1],{windowsHide:true},error=>{if(error)console.log('Open this address in your browser: '+url);});
 }
});
