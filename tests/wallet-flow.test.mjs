// Offline UI state-machine test. Generated fixture keys only; no RPC or real wallet.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {build} from 'esbuild';
import {webcrypto} from 'node:crypto';
import {Keypair,PublicKey,TransactionMessage,VersionedTransaction,ComputeBudgetProgram} from '@solana/web3.js';
import {depositInstruction,verifySigner,mergeSecondSignature,signedCheck,CSS_BY_FACTION} from '../src/core.js';

const bundle=(await build({entryPoints:['src/app.js'],bundle:true,write:false,platform:'browser',format:'iife',inject:['src/globals.js'],define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'offline-chain',setup(b){
 b.onResolve({filter:/^\.\/core\.js$/},()=>({path:'core',namespace:'offline'}));
 b.onResolve({filter:/^\.\/connection-check\.js$/},()=>({path:'check',namespace:'offline'}));
 b.onLoad({filter:/.*/,namespace:'offline'},({path})=>({contents:path==='check'?'export const checkDirectConnection=async()=>{};':'export const {connection,pk,prepare,verifySigner,mergeSecondSignature,signedCheck,mainnet,CSS_BY_FACTION,resolveProfileInput,findWalletProfiles}=globalThis.__testCore;',loader:'js'}));
}}]})).outputFiles[0].text;

async function setup({separate=false,failure=''}={}){
 const owner=Keypair.generate(),funder=separate?Keypair.generate():owner,profile=Keypair.generate().publicKey;
 const keys=Object.fromEntries(['sagePlayerProfile','originTokenAccount','ship','shipEscrowTokenAccount','starbase','starbasePlayer','profileFaction','gameId','gameState'].map(n=>[n,Keypair.generate().publicKey]));
 Object.assign(keys,{profile,key:owner.publicKey,funder:funder.publicKey,tokenProgram:new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),systemProgram:PublicKey.default});
 const makeTx=(amount='1')=>new VersionedTransaction(new TransactionMessage({payerKey:funder.publicKey,recentBlockhash:PublicKey.default.toBase58(),instructions:[ComputeBudgetProgram.setComputeUnitLimit({units:400000}),depositInstruction(keys,amount,null)]}).compileToV0Message());
 const tx=makeTx(),plan={owner:owner.publicKey,funder:funder.publicKey,tx,original:Buffer.from(tx.message.serialize()).toString('base64'),latest:{lastValidBlockHeight:123},maxDebit:500000,summary:{owner:owner.publicKey.toBase58(),funder:funder.publicKey.toBase58(),quantity:'1',ship:'Fixture TIP',starbase:'ONI CSS',maximumTotalFunderDebitSOL:'0.000500000',maximumNetworkFeeSOL:'0.0002'}};
 let sends=0,signs=0,checks=0,current=owner,stage;
 const saved=new Map(),elements=new Map();
 const make=()=>({value:'',textContent:'',disabled:false,hidden:false,checked:false,children:[],listeners:{},replaceChildren(){this.children=[];},appendChild(c){this.children.push(c);},addEventListener(name,fn){this.listeners[name]=fn;}});
 const el=id=>{if(!elements.has(id))elements.set(id,make());return elements.get(id);};
 const c={getBlockHeight:async()=>failure==='expired'?124:100,getFeeForMessage:async()=>({value:failure==='fee'?200001:5000}),getBalance:async()=>1000000,
  simulateTransaction:async(_,opts)=>{checks++;assert.equal(opts.sigVerify,true);return {value:{err:failure==='simulation'?{InstructionError:[2,'UnbalancedInstruction']}:null,accounts:[{lamports:failure==='debit'?0:990000}]}};},
  sendRawTransaction:async(bytes)=>{sends++;assert.ok(saved.has('sage-local-deposit-pending-v1'));assert.equal(VersionedTransaction.deserialize(bytes).message.header.numRequiredSignatures,separate?2:1);return JSON.parse(saved.get('sage-local-deposit-pending-v1')).signature;}};
 const ctx={console,document:{getElementById:el,createElement:make,modelContext:{registerTool:tool=>{stage=()=>tool.execute({}).stage;}}},navigator:{userAgent:'test',locks:{request:async(_,fn)=>fn()}},localStorage:{getItem:key=>saved.get(key)||null,setItem:(key,value)=>saved.set(key,value)},TextEncoder,TextDecoder,URL,URLSearchParams,AbortController,setTimeout,clearTimeout,crypto:webcrypto,addEventListener(){},fetch:()=>{throw Error('No network in fixture');},
  __testCore:{connection:()=>c,pk:value=>new PublicKey(value),prepare:async(_,args)=>{assert.equal(args.owner.toBase58(),owner.publicKey.toBase58());assert.equal(args.funder.toBase58(),funder.publicKey.toBase58());return plan;},verifySigner,mergeSecondSignature,signedCheck,mainnet:async()=>{},CSS_BY_FACTION,resolveProfileInput:async()=>profile,findWalletProfiles:async()=>({profiles:[profile.toBase58()],before:''})}};
 ctx.window=ctx;ctx.self=ctx;ctx.phantom={solana:{isPhantom:true,connect:async()=>({publicKey:current.publicKey}),signTransaction:async input=>{signs++;const signed=failure==='changed'?makeTx('2'):VersionedTransaction.deserialize(input.serialize());if(failure!=='signature')signed.sign([current]);return signed;}}};
 vm.runInNewContext(bundle,ctx,{timeout:10000});await el('connectOwner').onclick();
 assert.equal(el('funder').value,owner.publicKey.toBase58());assert.equal(signs,0);assert.equal(sends,0);
 if(separate){el('separateFunder').checked=true;el('separateFunder').onchange();current=funder;await el('connectFunder').onclick();current=owner;}
 el('mint').value=Keypair.generate().publicKey.toBase58();el('quantity').value='1';el('starbase').value=keys.starbase.toBase58();
 await el('prepare').onclick();assert.equal(stage(),1);el('ack').checked=true;el('ack').onchange();
 if(failure==='account')current=Keypair.generate();
 return {el,stage,saved,counts:()=>({sends,signs,checks}),useFunder:()=>{current=funder;}};
}

test('one-wallet approval reaches explicit Send with no second signature or automatic submission',async()=>{
 const f=await setup();await f.el('ownerSign').onclick();assert.equal(f.stage(),3);assert.equal(f.el('next').textContent,'Send this deposit');assert.equal(f.el('funderSign').disabled,true);assert.deepEqual(f.counts(),{sends:0,signs:1,checks:1});
 await f.el('submit').onclick();assert.equal(f.stage(),4);assert.deepEqual(f.counts(),{sends:1,signs:1,checks:2});assert.ok(f.saved.has('sage-local-deposit-pending-v1'));
 await f.el('submit').onclick();assert.equal(f.counts().sends,1);
});
test('bad approvals, changed wallet, failed/expired simulations and spend caps never unlock Send',async()=>{
 for(const failure of ['signature','changed','simulation','expired','fee','debit','account']){
  const f=await setup({failure});await f.el('ownerSign').onclick();assert.equal(f.stage(),1,failure);assert.equal(f.el('submit').disabled,true,failure);await f.el('submit').onclick();assert.equal(f.counts().sends,0,failure);assert.equal(f.saved.size,0,failure);
 }
});
test('optional separate funding still needs both signatures and a later explicit Send',async()=>{
 const f=await setup({separate:true});await f.el('ownerSign').onclick();assert.equal(f.stage(),2);assert.equal(f.counts().checks,0);assert.equal(f.el('submit').disabled,true);
 f.useFunder();await f.el('funderSign').onclick();assert.equal(f.stage(),3);assert.deepEqual(f.counts(),{sends:0,signs:2,checks:1});
 await f.el('submit').onclick();assert.equal(f.stage(),4);assert.deepEqual(f.counts(),{sends:1,signs:2,checks:2});
});
test('fee mode changes discard approvals and restore the ship wallet default',async()=>{
 const f=await setup();await f.el('ownerSign').onclick();assert.equal(f.stage(),3);
 f.el('separateFunder').checked=true;f.el('separateFunder').onchange();assert.equal(f.stage(),0);assert.equal(f.el('submit').disabled,true);assert.equal(f.el('funder').value,'');
 f.el('separateFunder').checked=false;f.el('separateFunder').onchange();assert.equal(f.el('funder').value,f.el('owner').value);assert.equal(f.counts().sends,0);
});
