import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
import {BorshAccountsCoder} from '@staratlas/anchor';
import {SAGE,PROFILE,profileCoder} from '../src/core.js';
import {Keypair} from '@solana/web3.js';
import {BN} from '@staratlas/anchor';
import bs58 from 'bs58';
test('browser bundle starts without Node globals or network calls',async()=>{
 const elements=new Map();let networkCalls=0,registered;
 const make=()=>({value:'',textContent:'',disabled:false,hidden:false,checked:false,children:[],listeners:{},replaceChildren(){this.children=[];},appendChild(c){this.children.push(c);},addEventListener(name,fn){this.listeners[name]=fn;}});
 const el=id=>{if(!elements.has(id))elements.set(id,make());return elements.get(id);};
 const document={getElementById:el,modelContext:{registerTool:tool=>{registered=tool;}},createElement:make};
 const ctx={console,document,navigator:{userAgent:'test'},location:{protocol:'http:',hostname:'127.0.0.1'},localStorage:{getItem:()=>null},TextEncoder,TextDecoder,URL,URLSearchParams,AbortController,setTimeout,clearTimeout,crypto:webcrypto,fetch:()=>{networkCalls++;throw Error('Unexpected network call');},addEventListener(){}};ctx.window=ctx;ctx.self=ctx;
 vm.runInNewContext(await readFile('dist/app.js','utf8'),ctx,{timeout:10000});
 assert.equal(networkCalls,0);assert.equal(el('submit').disabled,true);assert.equal(el('ownerSign').disabled,true);assert.equal(el('next').disabled,true);assert.equal(el('prepare').disabled,true);assert.equal(el('check').hidden,true);assert.equal(registered.name,'read_deposit_status');assert.equal(registered.execute({}).stage,0);assert.throws(()=>registered.execute({sign:true}));
 let walletCalls=0;ctx.phantom={solana:{isPhantom:true,connect:async()=>{walletCalls++;return {publicKey:{toBase58:()=> 'same-wallet'}};}}};el('owner').value='same-wallet';
 assert.equal(el('connectOwner').disabled,false);await el('connectOwner').onclick();assert.equal(walletCalls,1);assert.equal(networkCalls,0);assert.equal(el('owner').value,'same-wallet');assert.match(el('status').textContent,/Phantom connected/);
 assert.equal(el('funder').value,'same-wallet');assert.equal(el('separateFunderSection').hidden,true);
 el('separateFunder').checked=true;el('separateFunder').onchange();await el('connectFunder').onclick();assert.equal(walletCalls,2);assert.match(el('status').textContent,/still your ship wallet/);
 assert.equal(el('manualPrepare').disabled,true);await el('manualPrepare').onclick();assert.match(el('status').textContent,/Select a ship/);
 await el('submit').onclick();assert.match(el('status').textContent,/connection changed/);
 assert.equal(walletCalls,2);assert.equal(networkCalls,0);assert.equal(el('funder').value,'');assert.equal(el('next').disabled,true);
 el('rpc').value='https://example.invalid/?api-key=secret-not-for-display';await el('testRpc').onclick();
 assert.equal(networkCalls,1);assert.equal(walletCalls,2);assert.equal(el('connectOwner').disabled,false);assert.equal(el('owner').value,'same-wallet');assert.doesNotMatch(el('status').textContent,/secret-not-for-display/);
});

test('RPC checks govern deposits, not wallet connection; pending records survive changes',async()=>{
 const bundle=await readFile('dist/app.js','utf8');
 const game=Buffer.alloc(20000);BorshAccountsCoder.accountDiscriminator('game').copy(game);
 for(const isPending of [false,true]){
  const elements=new Map(),saved=new Map();let networkCalls=0,walletCalls=0;
  const record=JSON.stringify({signature:'public-pending-signature',lastValidBlockHeight:123,created:'2026-09-13'});
  if(isPending)saved.set('sage-local-deposit-pending-v1',record);
  const make=()=>({value:'',textContent:'',disabled:false,hidden:false,checked:false,children:[],listeners:{},replaceChildren(){this.children=[];},appendChild(c){this.children.push(c);},addEventListener(name,fn){this.listeners[name]=fn;}});
  const el=id=>{if(!elements.has(id))elements.set(id,make());return elements.get(id);};
  const account=data=>({data:[data.toString('base64'),'base64'],executable:false,lamports:1,owner:SAGE.toBase58(),rentEpoch:0});
  const ctx={console,document:{getElementById:el,createElement:make},navigator:{userAgent:'test'},localStorage:{getItem:key=>saved.get(key)||null},TextEncoder,TextDecoder,URL,URLSearchParams,AbortController,setTimeout,clearTimeout,crypto:webcrypto,addEventListener(){},fetch:async(url,options)=>{
   networkCalls++;const req=JSON.parse(options.body);let result;
   if(req.method==='getGenesisHash')result='5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d';
   else if(req.method==='getAccountInfo')result={context:{slot:1},value:account(game)};
   else if(req.method==='getMultipleAccounts')result={context:{slot:1},value:[account(game)]};
   else if(req.method==='getLatestBlockhash')result={context:{slot:1},value:{blockhash:SAGE.toBase58(),lastValidBlockHeight:123}};
   else throw Error('Unexpected request '+req.method);
   return new Response(JSON.stringify({jsonrpc:'2.0',id:req.id,result}));
  }};ctx.window=ctx;ctx.self=ctx;
  ctx.phantom={solana:{isPhantom:true,connect:async()=>{walletCalls++;return {publicKey:{toBase58:()=> 'same-wallet'}};}}};
  vm.runInNewContext(bundle,ctx,{timeout:10000});
  el('rpc').value='https://example.invalid/private-key';await el('testRpc').onclick();
  assert.match(el('connectionStatus').textContent,/checks passed/);assert.equal(networkCalls,3);assert.equal(walletCalls,0);assert.equal(el('connectOwner').disabled,isPending);
  if(!isPending){el('owner').value='same-wallet';el('separateFunder').checked=true;el('separateFunder').onchange();await el('connectFunder').onclick();assert.match(el('status').textContent,/still your ship wallet/);assert.equal(el('funder').value,'');}
  el('rpc').value='https://example.invalid/changed-key';el('rpc').listeners.input();
  assert.equal(el('connectOwner').disabled,isPending);assert.equal(el('manualPrepare').disabled,true);assert.equal(el('next').disabled,true);assert.equal(networkCalls,3);
  assert.equal(saved.get('sage-local-deposit-pending-v1'),isPending?record:undefined);
 }
});

test('connecting autofills a verified profile without signing, repeats, or losing the wallet on lookup failure',async()=>{
 const owner=Keypair.generate().publicKey,profile=Keypair.generate().publicKey,signature=bs58.encode(Buffer.alloc(64,3));
 const header=await profileCoder.accounts.encode('profile',{version:0,authKeyCount:1,keyThreshold:1,nextSeqId:new BN(0),createdAt:new BN(0)});
 const key=profileCoder.types.encode('ProfileKey',{key:owner,scope:PROFILE,expireTime:new BN(-1),permissions:[1,0,0,0,0,0,0,0]});
 const data=Buffer.concat([header,Buffer.from([1,0]),key]);
 const elements=new Map();let calls=0,signatures=0,fail=false;
 const make=()=>({value:'',textContent:'',disabled:false,hidden:false,checked:false,children:[],listeners:{},replaceChildren(){this.children=[];},appendChild(c){this.children.push(c);},addEventListener(name,fn){this.listeners[name]=fn;}});
 const el=id=>{if(!elements.has(id))elements.set(id,make());return elements.get(id);};
 const ctx={console,document:{getElementById:el,createElement:make},navigator:{userAgent:'test'},localStorage:{getItem:()=>null},TextEncoder,TextDecoder,URL,URLSearchParams,AbortController,setTimeout,clearTimeout,crypto:webcrypto,addEventListener(){},fetch:async(url,options)=>{
  calls++;if(fail)throw Error('Unavailable');const req=JSON.parse(options.body);let result;
  if(req.method==='getGenesisHash')result='5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d';
  else if(req.method==='getSignaturesForAddress'){assert.equal(req.params[0],owner.toBase58());assert.equal(req.params[1].limit,12);result=[{signature,slot:1,err:null,memo:null,blockTime:1,confirmationStatus:'confirmed'}];}
  else if(req.method==='getTransaction')result={slot:1,blockTime:1,version:'legacy',meta:{err:null,fee:5000,preBalances:[1,1,1],postBalances:[1,1,1],innerInstructions:[]},transaction:{signatures:[signature],message:{header:{numRequiredSignatures:1,numReadonlySignedAccounts:0,numReadonlyUnsignedAccounts:2},accountKeys:[owner,SAGE,profile].map(k=>k.toBase58()),recentBlockhash:SAGE.toBase58(),instructions:[{programIdIndex:1,accounts:[0,2],data:''}]}}};
  else if(req.method==='getMultipleAccounts')result={context:{slot:1},value:req.params[0].map(address=>address===profile.toBase58()?{data:[data.toString('base64'),'base64'],executable:false,lamports:1,owner:PROFILE.toBase58(),rentEpoch:0}:null)};
  else throw Error('Unexpected method: '+req.method);
  return new Response(JSON.stringify({jsonrpc:'2.0',id:req.id,result}));
 }};ctx.window=ctx;ctx.self=ctx;ctx.phantom={solana:{isPhantom:true,connect:async()=>({publicKey:owner}),signTransaction:()=>{signatures++;throw Error('No signing during lookup');}}};
 vm.runInNewContext(await readFile('dist/app.js','utf8'),ctx,{timeout:10000});assert.equal(calls,0);
 el('rpc').value='https://example.invalid/rpc';await el('connectOwner').onclick();
 assert.equal(el('owner').value,owner.toBase58());assert.equal(el('profile').value,profile.toBase58());assert.match(el('profileStatus').textContent,/authority verified/);assert.equal(calls,4);assert.equal(signatures,0);
 assert.equal(el('funder').value,owner.toBase58());assert.equal(el('connectFunder').disabled,true);
 await el('connectOwner').onclick();assert.equal(calls,4);assert.equal(el('playerProfilesLabel').hidden,true);
 el('rpc').value='https://example.invalid/new';el('rpc').listeners.input();fail=true;await el('connectOwner').onclick();
 assert.equal(el('owner').value,owner.toBase58());assert.match(el('profileStatus').textContent,/wallet is still connected/);assert.equal(signatures,0);assert.equal(el('connectOwner').disabled,false);
});
