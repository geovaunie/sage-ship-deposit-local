import test from 'node:test';
import assert from 'node:assert/strict';
import {rpcFetch} from '../src/rpc.js';
import {checkConnection,checkDirectConnection} from '../src/connection-check.js';
import {coder,SAGE} from '../src/core.js';

test('HTTP errors and provider messages never expose endpoint credentials',async()=>{
 for(const status of [401,403,429,500]){
  let calls=0;
  const call=rpcFetch(async()=>{calls++;return new Response('private-key-123',{status});});
  await assert.rejects(call('https://example.invalid/private-key-123'),e=>e.name==='RpcError'&&e.message.includes(String(status))&&!e.message.includes('private-key-123'));
  assert.equal(calls,1);
 }
 await assert.rejects(rpcFetch(async()=>new Response(JSON.stringify({error:{code:-32000,message:'private-key-123'}})))('https://example.invalid'),e=>e.message.includes('-32000')&&!e.message.includes('private-key-123'));
 await assert.rejects(rpcFetch(async()=>{throw Error('https://example.invalid/private-key-123');})('https://example.invalid'),/could not be reached/);
});
test('bounded fetch rejects malformed responses and timeout without retry',async()=>{
 await assert.rejects(rpcFetch(async()=>new Response('<html>login</html>'))('https://example.invalid'),/valid JSON/);
 let calls=0;
 await assert.rejects(rpcFetch(async(_,opts)=>{calls++;assert.equal(opts.redirect,'error');assert.equal(opts.credentials,'omit');return new Promise((_,reject)=>opts.signal.addEventListener('abort',()=>reject(Error('aborted'))));},10)('https://example.invalid'),/timed out/);
 assert.equal(calls,1);
});
test('connection probe requires indexed access, not only a successful genesis check',async()=>{
 // The game discriminator plus a zeroed fixed account layout is a valid version-0 fixture.
 const data=Buffer.alloc(20000);
 // Reuse the SDK decoder's discriminator rather than a fake RPC-only readiness flag.
 const {BorshAccountsCoder}=await import('@staratlas/anchor');
 BorshAccountsCoder.accountDiscriminator('game').copy(data);
 const methods=[];
 const c={getGenesisHash:async()=> '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d',getAccountInfo:async()=>({owner:SAGE,data}),getProgramAccounts:async(program,options)=>{methods.push(options);return [{pubkey:SAGE}];},getParsedTokenAccountsByOwner:async()=>({value:[]})};
 assert.equal(await checkConnection(c),true);assert.equal(methods.length,3);assert.ok(methods.every(m=>m.filters.length===2&&m.dataSlice.length===0));
 await assert.rejects(checkConnection({...c,getProgramAccounts:async()=>{throw Error('403 indexed reads forbidden');}}),/403/);
 await assert.rejects(checkConnection({...c,getProgramAccounts:async()=>[]}),/no SAGE ships/);
 await assert.rejects(checkConnection({...c,getGenesisHash:async()=> 'devnet'}),/not Solana mainnet/);
});
test('direct-mode probe uses no indexed methods and rejects missing or foreign game accounts',async()=>{const {BorshAccountsCoder}=await import('@staratlas/anchor');const data=Buffer.alloc(20000);BorshAccountsCoder.accountDiscriminator('game').copy(data);const c={getGenesisHash:async()=> '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d',getMultipleAccountsInfo:async()=>[{owner:SAGE,data}],getLatestBlockhash:async()=>({blockhash:SAGE.toBase58(),lastValidBlockHeight:123})};assert.equal(await checkDirectConnection(c),true);await assert.rejects(checkDirectConnection({...c,getMultipleAccountsInfo:async()=>[null]}),/game account/);});
test('public RPC pacing spaces starts without retrying or changing endpoint',async()=>{const starts=[];const call=rpcFetch(async url=>{assert.equal(url,'https://example.invalid');starts.push(Date.now());return new Response('{}');},1000,25);await Promise.all([call('https://example.invalid'),call('https://example.invalid'),call('https://example.invalid')]);assert.equal(starts.length,3);assert.ok(starts[1]-starts[0]>=20);assert.ok(starts[2]-starts[1]>=20);});
