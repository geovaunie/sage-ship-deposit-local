import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('SHA256SUMS.json',root),'utf8'));
for(const [name,expected]of Object.entries(manifest)){if(name.includes('..')||name.startsWith('/')||name.includes('\\'))throw Error('Invalid manifest path');const actual=createHash('sha256').update(await readFile(new URL(name,root))).digest('hex');if(actual!==expected)throw Error('Hash mismatch: '+name);}
console.log('All '+Object.keys(manifest).length+' distributed file hashes match. This checks integrity, not publisher authenticity.');
