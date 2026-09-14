import test from 'node:test';
import assert from 'node:assert/strict';
import {PublicKey,Keypair,SystemProgram} from '@solana/web3.js';
import {BN,BorshAccountsCoder} from '@staratlas/anchor';
import {IDL} from '@staratlas/sage/dist/src/idl/sage.js';
import {prepare,coder,profileCoder,SAGE,GAME,CSS_BY_FACTION,directSource,directShip,resolveProfileInput,findWalletProfiles} from '../src/core.js';
import {getAssociatedTokenAddressSync} from '@solana/spl-token';
import {discover} from '../src/discover.js';
import {BorshCoder} from '@staratlas/anchor';
import {IDL as FACTION_IDL} from '@staratlas/profile-faction/dist/src/idl/profile_faction.js';
const factionProgram=new PublicKey('pFACSRuobDmvfMKq1bAzwj27t6d2GJhSCHb1VcfnRmq');
const P=new PublicKey('pprofELXjL5Kck7Jn5hCpwAL82DpTkSYBENzahVtbc9');
const T=new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const key=()=>Keypair.generate().publicKey;
function zero(t){if(t==='publicKey')return PublicKey.default;if(t==='bool')return false;if(t==='string')return '';if(typeof t==='string')return /^(u|i)(64|128)$/.test(t)?new BN(0):0;if(t.array)return Array.from({length:t.array[1]},()=>zero(t.array[0]));if(t.defined){const def=IDL.types.find(d=>d.name===t.defined);if(def.type.kind==='struct')return Object.fromEntries(def.type.fields.map(f=>[f.name,zero(f.type)]));throw Error('Unsupported fixture type '+t.defined);}if(t.option)return null;throw Error('Fixture type '+JSON.stringify(t));}
function encode(name,overrides){const def=IDL.accounts.find(a=>a.name===name);const value={...Object.fromEntries(def.type.fields.map(f=>[f.name,zero(f.type)])),...overrides};const b=Buffer.alloc(20000);const n=coder.accounts.accountLayouts.get(name).encode(value,b);return Buffer.concat([BorshAccountsCoder.accountDiscriminator(name),b.subarray(0,n)]);}
async function fixture(manual=false){
 const owner=key(),funder=key(),profile=key(),starbase=manual?new PublicKey(CSS_BY_FACTION[2]):key(),mint=key(),ship=key(),source=manual?getAssociatedTokenAddressSync(mint,owner):key();const sageProfile=PublicKey.findProgramAddressSync([Buffer.from('sage_player_profile'),profile.toBuffer(),GAME.toBuffer()],SAGE)[0];
 const basePlayer=PublicKey.findProgramAddressSync([Buffer.from('starbase_player'),starbase.toBuffer(),sageProfile.toBuffer(),Buffer.from([0,0])],SAGE)[0];
 const profileHead=await profileCoder.accounts.encode('profile',{version:0,authKeyCount:1,keyThreshold:1,nextSeqId:new BN(0),createdAt:new BN(0)});
 const profileKey=profileCoder.types.encode('ProfileKey',{key:owner,scope:P,expireTime:new BN(-1),permissions:[1,0,0,0,0,0,0,0]});
 const account=(data,program=SAGE,lamports=100000000)=>({data,owner:program,lamports,executable:false,rentEpoch:0});
 const mintData=Buffer.alloc(82);mintData[45]=1;
 const map=new Map([[GAME.toBase58(),account(encode('game',{gameState:key()}))],[starbase.toBase58(),account(encode('starbase',{gameId:GAME}))],[profile.toBase58(),account(Buffer.concat([profileHead,Buffer.from([1,0]),profileKey]),P)],[basePlayer.toBase58(),account(encode('starbasePlayer',{playerProfile:profile,gameId:GAME,starbase,sagePlayerProfile:sageProfile}))],[mint.toBase58(),account(mintData,T)],[funder.toBase58(),account(Buffer.alloc(0),SystemProgram.programId)]]);
 let simulationError=null;
 map.set(owner.toBase58(),account(Buffer.alloc(0),SystemProgram.programId));
 const c={getGenesisHash:async()=> '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d',getAccountInfo:async k=>map.get(k.toBase58())||null,getProgramAccounts:async(_,opts)=>{assert.ok(opts.filters[0].memcmp.bytes);return [{pubkey:ship,account:account(encode('ship',{gameId:GAME,mint}))}];},getParsedTokenAccountsByOwner:async()=>({value:[{pubkey:source,account:{data:{parsed:{info:{owner:owner.toBase58(),mint:mint.toBase58(),state:'initialized',tokenAmount:{amount:'2',decimals:0}}}}}}]}),getLatestBlockhash:async()=>({blockhash:key().toBase58(),lastValidBlockHeight:123}),simulateTransaction:async()=>({value:{err:simulationError,accounts:[{lamports:98000000}]}})};
 if(manual){
  map.get(starbase.toBase58()).data=encode('starbase',{gameId:GAME,faction:2,level:6});
  const factionKey=PublicKey.findProgramAddressSync([Buffer.from('player_faction'),profile.toBuffer()],factionProgram)[0];
  map.set(factionKey.toBase58(),account(await new BorshCoder(FACTION_IDL).accounts.encode('profileFactionAccount',{version:0,profile,faction:2,bump:0}),factionProgram));
  map.set(ship.toBase58(),account(encode('ship',{gameId:GAME,mint})));
  const token=Buffer.alloc(165);mint.toBuffer().copy(token);owner.toBuffer().copy(token,32);token.writeBigUInt64LE(2n,64);token[108]=1;map.set(source.toBase58(),account(token,T));
  c.getMultipleAccountsInfo=async keys=>keys.map(k=>map.get(k.toBase58())||null);
  c.getProgramAccounts=async()=>{throw Error('Forbidden indexed query');};c.getParsedTokenAccountsByOwner=async()=>{throw Error('Forbidden inventory query');};
 }
 return {c,args:{owner,funder,profile,starbase,mint,amount:'1',...(manual?{directMode:true,shipRegistration:ship}:{})},map,ship,source,basePlayer,setError:e=>{simulationError=e;}};
}
test('complete prepare with mocked chain and no signer',async()=>{const f=await fixture();const p=await prepare(f.c,f.args);assert.equal(p.summary.quantity,'1');assert.equal(p.tx.message.header.numRequiredSignatures,2);assert.equal(p.maxDebit,2200000);assert.ok(p.tx.signatures.every(s=>s.every(v=>v===0)));});
test('prepare fails closed for wrong funder, missing profile and failed simulation',async()=>{const f=await fixture();await assert.rejects(prepare(f.c,{...f.args,funder:key()}),/funded standard SOL wallet/);f.setError({InstructionError:[2,'UnbalancedInstruction']});await assert.rejects(prepare(f.c,f.args),/simulation failed/);f.setError(null);f.map.delete(f.args.profile.toBase58());await assert.rejects(prepare(f.c,f.args),/not found/);});
test('single-wallet direct prepare needs one signature and preserves funding, source and simulation checks',async()=>{
 const f=await fixture(true),args={...f.args,funder:undefined};
 const p=await prepare(f.c,args);assert.equal(p.funder.toBase58(),f.args.owner.toBase58());assert.equal(p.tx.message.header.numRequiredSignatures,1);assert.equal(p.summary.requiredApprovals,1);assert.ok(p.tx.signatures.every(s=>s.every(v=>v===0)));
 f.setError({InstructionError:[2,'UnbalancedInstruction']});await assert.rejects(prepare(f.c,args),/simulation failed/);f.setError(null);
 f.map.get(f.source.toBase58()).data.writeBigUInt64LE(0n,64);await assert.rejects(prepare(f.c,args),/insufficient unfrozen ships/);f.map.get(f.source.toBase58()).data.writeBigUInt64LE(1n,64);
 f.map.get(f.args.owner.toBase58()).owner=SAGE;await assert.rejects(prepare(f.c,args),/funded standard SOL wallet/);
});
async function discoveryFixture(){
 const f=await fixture(),ships=f.c.getProgramAccounts,tokens=f.c.getParsedTokenAccountsByOwner;
 const base=f.map.get(f.args.starbase.toBase58());base.data=encode('starbase',{gameId:GAME,faction:2,level:6});
 f.c.getProgramAccounts=async(program,opts)=>{
  if(program.equals(P)){assert.equal(opts.filters[1].memcmp.offset,30);return [{pubkey:f.args.profile,account:f.map.get(f.args.profile.toBase58())}];}
  if(opts.filters[0].memcmp.bytes===coder.accounts.memcmp('starbase').bytes)return [{pubkey:f.args.starbase,account:base}];
  return ships(program,opts);
 };
 f.c.getParsedTokenAccountsByOwner=async(...args)=>{const rows=await tokens(...args);rows.value.forEach(r=>{r.account.owner=T;});return rows;};
 const factionData=await new BorshCoder(FACTION_IDL).accounts.encode('profileFactionAccount',{version:0,profile:f.args.profile,faction:2,bump:0});
 const faction={owner:factionProgram,data:factionData};
 const factionKey=PublicKey.findProgramAddressSync([Buffer.from('player_faction'),f.args.profile.toBuffer()],factionProgram)[0];
 f.c.getMultipleAccountsInfo=async keys=>keys.map(k=>k.equals(factionKey)?faction:f.map.get(k.toBase58())||null);
 return {...f,faction};
}
test('discovery finds verified profile, faction CSS and owned ship without address input',async()=>{const f=await discoveryFixture();const result=await discover(f.c,f.args.owner);assert.equal(result.destinations.length,1);assert.equal(result.destinations[0].faction,'ONI');assert.equal(result.destinations[0].starbase,f.args.starbase.toBase58());assert.equal(result.ships[0].mint,f.args.mint.toBase58());assert.equal(result.ships[0].available,'2');});
test('discovery supports explicit profile hint and handles empty wallet',async()=>{const f=await discoveryFixture();f.c.getParsedTokenAccountsByOwner=async()=>({value:[]});const result=await discover(f.c,f.args.owner,f.args.profile.toBase58());assert.equal(result.destinations.length,1);assert.equal(result.ships.length,0);});
test('discovery rejects forged faction or wrong owner instead of guessing CSS',async()=>{const f=await discoveryFixture();f.faction.owner=SAGE;await assert.rejects(discover(f.c,f.args.owner),/registration was not found/);await assert.rejects(discover(f.c,key(),f.args.profile.toBase58()),/No supported game profile/);});

test('manual prepare completes without either indexed RPC, checks two signers and unsigned simulation',async()=>{const f=await fixture(true);const p=await prepare(f.c,f.args);assert.equal(p.beforeSource,'2');assert.equal(p.source.toBase58(),f.source.toBase58());assert.equal(p.tx.message.header.numRequiredSignatures,2);assert.ok(p.tx.signatures.every(s=>s.every(v=>v===0)));f.setError({InstructionError:[2,'UnbalancedInstruction']});await assert.rejects(prepare(f.c,f.args),/simulation failed/);});
test('manual mode never falls back into a scan when registration is missing',async()=>{const f=await fixture(true);await assert.rejects(prepare(f.c,{...f.args,shipRegistration:undefined}),/public SAGE ship-registration/);});
test('direct source rejects frozen, corrupt, wrong owner/mint, insufficient and missing accounts',async()=>{const f=await fixture(true);const raw=f.map.get(f.source.toBase58()),original=Buffer.from(raw.data);for(const change of [b=>{b[108]=2;},b=>{b[108]=3;},b=>key().toBuffer().copy(b,32),b=>key().toBuffer().copy(b),b=>b.writeBigUInt64LE(0n,64)]){raw.data=Buffer.from(original);change(raw.data);await assert.rejects(directSource(f.c,f.args.owner,f.args.mint,'1'));}raw.data=original;const other=key();f.map.set(other.toBase58(),raw);assert.equal((await directSource(f.c,f.args.owner,f.args.mint,'1',other)).pubkey.toBase58(),other.toBase58());f.map.delete(f.source.toBase58());await assert.rejects(directSource(f.c,f.args.owner,f.args.mint,'1'),/No ship at/);});
test('manual prepare verifies faction CSS and current ship registration',async()=>{const f=await fixture(true);const base=f.map.get(f.args.starbase.toBase58());base.data=encode('starbase',{gameId:GAME,faction:1,level:6});await assert.rejects(prepare(f.c,f.args),/faction's CSS/);await assert.rejects(directShip(f.c,f.ship,key()),/Ship mint mismatch/);const raw=f.map.get(f.ship.toBase58());raw.executable=true;await assert.rejects(directShip(f.c,f.ship,f.args.mint),/Executable/);raw.executable=false;raw.owner=P;await assert.rejects(directShip(f.c,f.ship,f.args.mint),/program mismatch/);});
function setEscrow(f,entries){const raw=f.map.get(f.basePlayer.toBase58()),head=coder.accounts.decode('starbasePlayer',raw.data);head.shipEscrowCount=entries.length;const encoded=encode('starbasePlayer',head);const body=entries.map(e=>coder.types.encode('WrappedShipEscrow',{ship:e.ship,amount:new BN(e.amount||0),updateId:new BN(0)}));raw.data=Buffer.concat([encoded,...body]);}
test('manual mode resolves CSS-held ship hints but rejects retired same-mint escrow entries',async()=>{const f=await fixture(true);setEscrow(f,[{ship:f.ship,amount:0}]);const p=await prepare(f.c,{...f.args,shipRegistration:undefined});assert.equal(p.ship.toBase58(),f.ship.toBase58());const old=key(),entry={...f.map.get(f.ship.toBase58()),data:encode('ship',{gameId:GAME,mint:f.args.mint,next:{key:f.ship,seqId:0}})};f.map.set(old.toBase58(),entry);setEscrow(f,[{ship:old,amount:0}]);await assert.rejects(prepare(f.c,f.args),/older ship registration/);});
test('profile input accepts a public address without RPC and rejects malformed links',async()=>{const profile=key();assert.equal((await resolveProfileInput({},profile.toBase58(),key())).toBase58(),profile.toBase58());for(const value of ['https://evil.example/tx/abc','a seed phrase is never accepted'])await assert.rejects(resolveProfileInput({},value,key()));});
test('transaction-link profile resolution verifies current ownership and rejects non-SAGE or failed receipts',async()=>{const f=await fixture(true);const {default:bs58}=await import('bs58');const signature=bs58.encode(Buffer.alloc(64,1)),keys=[SAGE,f.args.profile];const receipt={meta:{err:null,loadedAddresses:{readonly:[],writable:[]}},transaction:{message:{compiledInstructions:[{programIdIndex:0}],getAccountKeys:()=>({length:keys.length,get:i=>keys[i]})}}};f.c.getTransaction=async()=>receipt;assert.equal((await resolveProfileInput(f.c,'https://solscan.io/tx/'+signature,f.args.owner)).toBase58(),f.args.profile.toBase58());await assert.rejects(resolveProfileInput(f.c,signature,key()),/exactly one profile/);receipt.meta.err={InstructionError:[0,'Custom']};await assert.rejects(resolveProfileInput(f.c,signature,f.args.owner),/Successful transaction receipt unavailable/);receipt.meta.err=null;keys[0]=P;await assert.rejects(resolveProfileInput(f.c,signature,f.args.owner),/not a supported SAGE transaction/);});
test('direct ship follows a validated update and rejects a cycle',async()=>{const f=await fixture(true),next=key();f.map.set(next.toBase58(),{...f.map.get(f.ship.toBase58())});f.map.get(f.ship.toBase58()).data=encode('ship',{gameId:GAME,mint:f.args.mint,next:{key:next,seqId:0}});assert.equal((await directShip(f.c,f.ship,f.args.mint)).pubkey.toBase58(),next.toBase58());f.map.get(next.toBase58()).data=encode('ship',{gameId:GAME,mint:f.args.mint,next:{key:f.ship,seqId:0}});await assert.rejects(directShip(f.c,f.ship,f.args.mint),/update loop/);});

async function historyFixture(){
 const f=await fixture(true),{default:bs58}=await import('bs58'),signature=bs58.encode(Buffer.alloc(64,2));
 const keys=[f.args.owner,SAGE,f.args.profile],loaded={readonly:[f.args.profile],writable:[]};
 const receipt={meta:{err:null,loadedAddresses:loaded},transaction:{message:{compiledInstructions:[{programIdIndex:1}],getAccountKeys:opts=>{assert.equal(opts.accountKeysFromLookups,loaded);return {length:keys.length,get:i=>keys[i]};}}}};
 let transactionReads=0,accountReads=0;
 f.c.getSignaturesForAddress=async(owner,opts)=>{assert.equal(owner.toBase58(),f.args.owner.toBase58());assert.equal(opts.limit,12);return [{signature,err:null}];};
 f.c.getTransaction=async(_,opts)=>{assert.equal(opts.maxSupportedTransactionVersion,0);transactionReads++;return receipt;};
 const getAccounts=f.c.getMultipleAccountsInfo;f.c.getMultipleAccountsInfo=async keys=>{assert.ok(keys.length<=100);accountReads++;return getAccounts(keys);};
 return {...f,keys,receipt,signature,counts:()=>({transactionReads,accountReads})};
}
test('automatic wallet profile lookup verifies current authority using bounded public history',async()=>{
 const f=await historyFixture(),result=await findWalletProfiles(f.c,f.args.owner);
 assert.deepEqual(result.profiles,[f.args.profile.toBase58()]);assert.equal(result.before,'');assert.equal(result.checked,1);assert.deepEqual(f.counts(),{transactionReads:1,accountReads:1});
 // Loaded keys, not only legacy/static keys, participate in the discovery.
 f.receipt.transaction.message.compiledInstructions=[];f.receipt.meta.innerInstructions=[{instructions:[{programIdIndex:1}]}];
 assert.equal((await findWalletProfiles(f.c,f.args.owner)).profiles.length,1);
});
test('lookup rejects failed, unrelated, executable, foreign-owner and no-longer-authorized profiles',async()=>{
 const f=await historyFixture();f.receipt.meta.err={InstructionError:[0,'Custom']};assert.deepEqual((await findWalletProfiles(f.c,f.args.owner)).profiles,[]);
 f.receipt.meta.err=null;f.keys[1]=key();assert.deepEqual((await findWalletProfiles(f.c,f.args.owner)).profiles,[]);f.keys[1]=SAGE;
 const raw=f.map.get(f.args.profile.toBase58());raw.executable=true;assert.deepEqual((await findWalletProfiles(f.c,f.args.owner)).profiles,[]);raw.executable=false;
 raw.owner=SAGE;assert.deepEqual((await findWalletProfiles(f.c,f.args.owner)).profiles,[]);raw.owner=P;
 key().toBuffer().copy(raw.data,30);assert.deepEqual((await findWalletProfiles(f.c,f.args.owner)).profiles,[]);
});
test('lookup returns multiple owned profiles for explicit selection and deduplicates keys',async()=>{
 const f=await historyFixture(),other=key();f.map.set(other.toBase58(),f.map.get(f.args.profile.toBase58()));f.keys.push(other,f.args.profile);
 const result=await findWalletProfiles(f.c,f.args.owner);assert.deepEqual(result.profiles.sort(),[f.args.profile.toBase58(),other.toBase58()].sort());
});
test('lookup reads at most one twelve-reference page and preserves a user-controlled older cursor',async()=>{
 const f=await historyFixture(),{default:bs58}=await import('bs58'),rows=Array.from({length:30},(_,i)=>({signature:bs58.encode(Buffer.alloc(64,i+1)),err:i===0?{failed:true}:null}));let cursor;
 f.c.getSignaturesForAddress=async(_,opts)=>{assert.equal(opts.limit,12);cursor=opts.before;return rows;};
 const result=await findWalletProfiles(f.c,f.args.owner,{before:f.signature});assert.equal(cursor,f.signature);assert.equal(result.checked,12);assert.equal(result.receipts,11);assert.equal(result.before,rows[11].signature);assert.equal(f.counts().accountReads,1);
 await assert.rejects(findWalletProfiles(f.c,f.args.owner,{before:'bad cursor'}),/Invalid profile lookup cursor/);
 f.c.getGenesisHash=async()=> 'not-mainnet';await assert.rejects(findWalletProfiles(f.c,f.args.owner),/not Solana mainnet/);
});
