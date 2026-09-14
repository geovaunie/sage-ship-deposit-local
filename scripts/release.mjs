// Deliberate allowlist: never package node_modules, credentials, or workspace files.
import {readdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const roots=['src','public','scripts','tests','dist'];
const files=['.gitignore','package.json','package-lock.json','README.md','RELEASE-NOTES.md','SECURITY.md','LICENSE','THIRD-PARTY-NOTICES.txt','START-WINDOWS.cmd','START-HERE.txt','runtime/LICENSE','runtime/PROVENANCE.md'];
if(!process.argv.includes('--source'))files.push('runtime/node.exe');
async function collect(dir){for(const e of await readdir(dir,{withFileTypes:true})){const p=dir+'/'+e.name;if(e.isDirectory())await collect(p);else if(e.isFile())files.push(p);}}
for(const root of roots)await collect(root);
const hashes={};for(const file of files.sort())hashes[file]=createHash('sha256').update(await readFile(file)).digest('hex');
await writeFile('SHA256SUMS.json',JSON.stringify(hashes,null,2)+'\n');
console.log('Manifest generated for '+files.length+' allowlisted files.');
