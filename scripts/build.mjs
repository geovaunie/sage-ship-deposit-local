import {build} from 'esbuild';
import {mkdir,copyFile,writeFile,readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
await mkdir('dist',{recursive:true});
const result=await build({entryPoints:['src/app.js'],outfile:'dist/app.js',bundle:true,platform:'browser',format:'iife',target:['chrome110'],metafile:true,legalComments:'eof',minify:false,inject:['src/globals.js'],define:{'process.env.NODE_ENV':'"production"'}});
for(const file of ['index.html','style.css'])await copyFile('public/'+file,'dist/'+file);
const packages=new Map();
for(const input of Object.keys(result.metafile.inputs).filter(p=>p.includes('node_modules/'))){
 let directory=path.dirname(path.resolve(input));
 while(directory!==path.dirname(directory)){
  try{const data=JSON.parse(await readFile(path.join(directory,'package.json'),'utf8'));if(data.name&&data.version){packages.set(directory,data);break;}}catch{}
  directory=path.dirname(directory);
 }
}
let notices='Bundled dependency licenses (source packages are pinned by package-lock.json).\n';
for(const [directory,pkg] of [...packages.entries()].sort((a,b)=>a[1].name.localeCompare(b[1].name))){
 notices+='\n\n=== '+pkg.name+'@'+pkg.version+' | '+JSON.stringify(pkg.license)+' ===\n';
 const licenses=(await readdir(directory)).filter(n=>/^(licen[sc]e|copying|notice)/i.test(n));
 if(!licenses.length){
  if(['Apache-2.0','(MIT OR Apache-2.0)'].includes(pkg.license))notices+='Using the declared Apache-2.0 license option; npm package omits license text. Standard terms follow.\n'+await readFile('node_modules/@staratlas/sage/LICENSE','utf8');
  else if(pkg.license==='MIT'){
   const mit=await readFile('node_modules/bs58/LICENSE','utf8');
   notices+='Package declares MIT but omits a license file. Author metadata: '+JSON.stringify(pkg.author||null)+'\n';
   try{notices+=await readFile(path.join(directory,'README.md'),'utf8');}catch{}
   notices+='\nStandard MIT permission terms:\n'+mit.slice(mit.indexOf('Permission is hereby granted'));
  }
  else throw Error('Missing bundled package license: '+pkg.name);
 }
 for(const name of licenses){try{notices+='\n'+name+'\n'+await readFile(path.join(directory,name),'utf8');}catch(e){if(e.code!=='EISDIR')throw e;}}
}
await writeFile('THIRD-PARTY-NOTICES.txt',notices);
