import {Buffer} from 'buffer';
import {PublicKey, Connection, TransactionInstruction, TransactionMessage, VersionedTransaction, ComputeBudgetProgram, SystemProgram} from '@solana/web3.js';
import {BorshCoder, BN} from '@staratlas/anchor';
import {IDL} from '@staratlas/sage/dist/src/idl/sage.js';
import {IDL as PROFILE_IDL} from '@staratlas/player-profile/dist/src/idl/player_profile.js';
import {TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, createAssociatedTokenAccountIdempotentInstruction, unpackAccount} from '@solana/spl-token';
import {IDL as FACTION_IDL} from '@staratlas/profile-faction/dist/src/idl/profile_faction.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import {rpcFetch} from './rpc.js';

export const SAGE=new PublicKey('SAGE2HAwep459SNq61LHvjxPk4pLPEJLoMETef7f7EE');
export const GAME=new PublicKey('GAMEzqJehF8yAnKiTARUuhZMvLvkZVAsCVri5vSfemLr');
export const PROFILE=new PublicKey('pprofELXjL5Kck7Jn5hCpwAL82DpTkSYBENzahVtbc9');
export const FACTION=new PublicKey('pFACSRuobDmvfMKq1bAzwj27t6d2GJhSCHb1VcfnRmq');
export const CSS_BY_FACTION={1:'8Hr93jyQUiZfa4CQQiJ48CAZbotcUYWPMBVzzYb49nss',2:'5LVVJEAYEQPMoKp45r7GfNcnNDro1oFDgnLo7XHha3Xp',3:'94LdKdSHuG3Na6H1YhkgJsq1caYVxUNeBRm7rLB6hd8k'};
export const coder=new BorshCoder(IDL),profileCoder=new BorshCoder(PROFILE_IDL);
export const pk=value=>new PublicKey(value.trim());
const eq=(a,b,label)=>{if(!a.equals(b))throw Error(label+' mismatch');};
const pda=(seeds,program=SAGE)=>PublicKey.findProgramAddressSync(seeds,program)[0];
const str=s=>Buffer.from(s);
export function quantity(value){if(!/^[1-9][0-9]*$/.test(value)||BigInt(value)>18446744073709551615n)throw Error('Quantity must be a positive whole number within u64.');return value;}
export function connection(url){let u;try{u=new URL(url);}catch{throw Error('Enter a Solana Mainnet HTTPS RPC URL.');}if(u.protocol!=='https:'||u.username||u.password||u.hash)throw Error('Use a trusted HTTPS Solana RPC URL.');return new Connection(u.href,{commitment:'confirmed',disableRetryOnRateLimit:true,fetch:rpcFetch(undefined,20000,u.hostname==='rpc.solanatracker.io'?350:0)});}
export async function mainnet(c){if(await c.getGenesisHash()!=='5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d')throw Error('RPC is not Solana mainnet.');}
async function account(c,key,name,program=SAGE,codec=coder){const raw=await c.getAccountInfo(key);if(!raw)throw Error(name+' account not found. Register in the official game first.');eq(raw.owner,program,name+' program');if(raw.executable)throw Error('Executable '+name+' account rejected.');const data=codec.accounts.decode(name,raw.data);if(data.version!==0)throw Error('Unsupported '+name+' version.');return {data,raw};}

export async function directShip(c,registration,mint){
 const visited=new Set();let key=registration;
 for(let i=0;i<8;i++){
  if(visited.has(key.toBase58()))throw Error('Ship registration update loop.');visited.add(key.toBase58());
  const {data,raw}=await account(c,key,'ship');eq(data.gameId,GAME,'Ship game');eq(data.mint,mint,'Ship mint');
  if(data.next.key.equals(PublicKey.default))return {pubkey:key,data,account:raw};
  key=data.next.key;
 }
 throw Error('Ship registration update chain is too long. Ask support for the current registration.');
}

export async function directSource(c,owner,mint,amount,explicit){
 const key=explicit||getAssociatedTokenAddressSync(mint,owner),raw=await c.getAccountInfo(key);
 if(!raw)throw Error('No ship at the standard wallet holding address. It may already be deposited, or held in a different token account. Use the optional source token-account field for that case.');
 if(raw.executable||!raw.owner.equals(TOKEN_PROGRAM_ID)||raw.data.length!==165||raw.data[108]!==1)throw Error('Unsupported or frozen source token account.');
 const token=unpackAccount(key,raw);eq(token.owner,owner,'Source owner');eq(token.mint,mint,'Source mint');
 if(!token.isInitialized||token.isFrozen||token.amount<BigInt(amount))throw Error('Selected wallet account has insufficient unfrozen ships for this deposit.');
 return {pubkey:key,amount:token.amount.toString()};
}

async function directEscrowShips(c,escrow,raw){
 if(raw.length!==170+escrow.shipEscrowCount*48||escrow.shipEscrowCount>2000)throw Error('Unsupported starbase escrow layout.');
 const entries=[];for(let i=0;i<escrow.shipEscrowCount;i++)entries.push(coder.types.decode('WrappedShipEscrow',raw.subarray(170+i*48,218+i*48)));
 const unique=[...new Map(entries.map(e=>[e.ship.toBase58(),e.ship])).values()],result=[];
 for(let i=0;i<unique.length;i+=100){const keys=unique.slice(i,i+100),rows=await c.getMultipleAccountsInfo(keys);for(let j=0;j<keys.length;j++){
  const r=rows[j];if(!r||r.executable||!r.owner.equals(SAGE))throw Error('Cannot verify existing ship escrow registration.');
  const data=coder.accounts.decode('ship',r.data);if(data.version!==0||!data.gameId.equals(GAME))throw Error('Unsupported existing ship escrow registration.');result.push({pubkey:keys[j],data});
 }}return result;
}
export function profileHasOwner(raw,owner,now=Math.floor(Date.now()/1000)){
 const data=profileCoder.accounts.decode('profile',raw);
 if(data.version!==0||data.keyThreshold!==1)throw Error('Only standard single-authority profiles are supported.');
 if(raw.length<30)throw Error('Truncated profile.');
 const count=raw.readUInt16LE(28);if(raw.length!==30+count*80)throw Error('Unsupported profile key layout.');
 for(let i=0;i<count;i++){
  const k=profileCoder.types.decode('ProfileKey',raw.subarray(30+i*80,110+i*80));
  if(k.key.equals(owner)&&k.scope.equals(PROFILE)&&(k.permissions[0]&1)!==0&&(k.expireTime.isNeg()||k.expireTime.gt(new BN(now))))return true;
 }
 return false;
}

export async function resolveProfileInput(c,input,owner){
 const text=input.trim();try{return new PublicKey(text);}catch{}
 let signature=text;
 if(text.startsWith('https://')){const url=new URL(text);if(url.hostname!=='solscan.io'||url.username||url.password||url.port||!/^\/tx\/[1-9A-HJ-NP-Za-km-z]+\/?$/.test(url.pathname))throw Error('Use a Player Profile address or a Solscan transaction link.');signature=url.pathname.split('/')[2];}
 let bytes;try{bytes=bs58.decode(signature);}catch{}
 if(bytes?.length!==64)throw Error('Use a Player Profile address or the signature/link of one successful SAGE transaction.');
 const receipt=await c.getTransaction(signature,{maxSupportedTransactionVersion:0});
 if(!receipt||!receipt.meta||receipt.meta.err)throw Error('Successful transaction receipt unavailable. Enter the public Player Profile address instead.');
 const message=receipt.transaction.message,all=message.getAccountKeys({accountKeysFromLookups:receipt.meta.loadedAddresses});
 if(all.length>256||!(message.compiledInstructions||message.instructions).some(i=>all.get(i.programIdIndex)?.equals(SAGE)))throw Error('This is not a supported SAGE transaction. Enter your Player Profile address instead.');
 const keys=Array.from({length:all.length},(_,i)=>all.get(i)),found=[];
 for(let i=0;i<keys.length;i+=100){const part=keys.slice(i,i+100),rows=await c.getMultipleAccountsInfo(part);for(let j=0;j<part.length;j++){const raw=rows[j];try{if(raw&&!raw.executable&&raw.owner.equals(PROFILE)&&profileHasOwner(raw.data,owner))found.push(part[j]);}catch{}}}
 const unique=[...new Map(found.map(k=>[k.toBase58(),k])).values()];
 if(unique.length!==1)throw Error('Could not identify exactly one profile controlled by the connected ship wallet. Enter its Player Profile address instead.');
 return unique[0];
}
// Discovery only: bounded public history, then CURRENT profile authority checks.
// History is not an exhaustive registry and never authorizes a transaction.
export async function findWalletProfiles(c,owner,{before}={}){
 if(before){let bytes;try{bytes=bs58.decode(before);}catch{}if(bytes?.length!==64)throw Error('Invalid profile lookup cursor.');}
 await mainnet(c);
 const limit=12,rows=(await c.getSignaturesForAddress(owner,{limit,...(before?{before}:{})})).slice(0,limit);
 const candidates=new Map();let last='',processed=0,receipts=0;
 for(const row of rows){
  if(!row.err){
   const receipt=await c.getTransaction(row.signature,{maxSupportedTransactionVersion:0});receipts++;
   if(receipt?.meta&&!receipt.meta.err){
    let keys=[];
    try{
     const message=receipt.transaction.message,all=message.getAccountKeys({accountKeysFromLookups:receipt.meta.loadedAddresses});
     if(all.length<=256){
      const instructions=[...(message.compiledInstructions||message.instructions),...(receipt.meta.innerInstructions||[]).flatMap(group=>group.instructions)];
      const supported=instructions.some(i=>[SAGE,PROFILE].some(program=>all.get(i.programIdIndex)?.equals(program)));
      const referenced=Array.from({length:all.length},(_,i)=>all.get(i));
      if(supported&&referenced.some(k=>k.equals(owner)))keys=referenced;
     }
    }catch{/* A malformed/unsupported receipt is not a profile candidate. */}
    const additions=keys.filter(k=>!candidates.has(k.toBase58()));
    if(candidates.size+additions.length>512)break;
    for(const key of additions)candidates.set(key.toBase58(),key);
   }
  }
  last=row.signature;processed++;
 }
 const keys=[...candidates.values()],profiles=[];
 for(let i=0;i<keys.length;i+=100){
  const part=keys.slice(i,i+100),accounts=await c.getMultipleAccountsInfo(part);
  for(let j=0;j<part.length;j++){
   const raw=accounts[j];
   try{if(raw&&!raw.executable&&raw.owner.equals(PROFILE)&&profileHasOwner(raw.data,owner))profiles.push(part[j].toBase58());}catch{}
  }
 }
 return {profiles,checked:processed,receipts,before:last&&(rows.length===limit||processed<rows.length)?last:''};
}
export function depositInstruction(addresses,amount,index){
 const definition=IDL.instructions.find(i=>i.name==='addShipEscrow');
 const keys=[];
 const flatten=items=>{for(const item of items){if(item.accounts)flatten(item.accounts);else{if(!addresses[item.name])throw Error('Missing account '+item.name);keys.push({pubkey:addresses[item.name],isSigner:item.isSigner,isWritable:item.isMut});}}};
 flatten(definition.accounts);
 return new TransactionInstruction({programId:SAGE,keys,data:coder.instruction.encode('addShipEscrow',{input:{shipAmount:new BN(quantity(amount)),index}})});
}
export async function prepare(c,{owner,funder=owner,profile,starbase,mint,amount,shipRegistration,sourceTokenAccount,directMode=false}){
 const manual=directMode||!!shipRegistration;
 quantity(amount);
 await mainnet(c);
 const [{data:game},{data:base},{raw:profileRaw}]=await Promise.all([account(c,GAME,'game'),account(c,starbase,'starbase'),account(c,profile,'profile',PROFILE,profileCoder)]);
 if(!profileHasOwner(profileRaw.data,owner))throw Error('The connected ship owner is not a current primary authority of this profile.');
 eq(base.gameId,GAME,'Starbase game');
 if(manual){
  const {data:faction}=await account(c,pda([str('player_faction'),profile.toBuffer()],FACTION),'profileFactionAccount',FACTION,new BorshCoder(FACTION_IDL));
  eq(faction.profile,profile,'Faction profile');
  if(![1,2,3].includes(faction.faction)||base.faction!==faction.faction||base.level<6)throw Error('Destination is not this profile faction\'s CSS.');
  eq(starbase,new PublicKey(CSS_BY_FACTION[faction.faction]),'Faction CSS address');
 }
 const sageProfile=pda([str('sage_player_profile'),profile.toBuffer(),GAME.toBuffer()]);
 const seq=Buffer.alloc(2);seq.writeUInt16LE(base.seqId);
 const basePlayer=pda([str('starbase_player'),starbase.toBuffer(),sageProfile.toBuffer(),seq]);
 const [{data:escrow,raw:escrowRaw},mintRaw,funderRaw]=await Promise.all([account(c,basePlayer,'starbasePlayer'),c.getAccountInfo(mint),c.getAccountInfo(funder)]);
 eq(escrow.playerProfile,profile,'Starbase profile');eq(escrow.gameId,GAME,'Escrow game');eq(escrow.starbase,starbase,'Starbase');eq(escrow.sagePlayerProfile,sageProfile,'SAGE profile');
 if(!funderRaw||funderRaw.executable||!funderRaw.owner.equals(SystemProgram.programId)||funderRaw.data.length!==0)throw Error('Funder must be a funded standard SOL wallet.');
 if(!mintRaw||mintRaw.executable||!mintRaw.owner.equals(TOKEN_PROGRAM_ID)||mintRaw.data.length!==82||mintRaw.data[44]!==0||mintRaw.data[45]!==1)throw Error('Only initialized, zero-decimal classic SPL ship mints are supported.');
 const existing=manual?await directEscrowShips(c,escrow,escrowRaw.data):[];
 const seed=shipRegistration||existing.find(s=>s.data.mint.equals(mint))?.pubkey;
 if(manual&&!seed)throw Error('This ship type is not in the bundled registration list or your CSS escrow yet. Enter its public SAGE ship-registration address under Advanced. No wallet approval requested.');
 const selected=manual?await directShip(c,seed,mint):null;
 const results=selected?[]:await c.getProgramAccounts(SAGE,{filters:[{memcmp:coder.accounts.memcmp('ship')},{memcmp:{offset:41,bytes:mint.toBase58()}}]});
 const ships=selected?existing.filter(s=>s.data.mint.equals(mint)):results.map(s=>({...s,data:coder.accounts.decode('ship',s.account.data)})).filter(s=>s.data.version===0&&s.data.gameId.equals(GAME));
 const current=selected?[selected]:ships.filter(s=>s.data.next.key.equals(PublicKey.default));
 if(current.length!==1)throw Error('Cannot identify one current SAGE ship registration for this mint.');
 const ship=current[0];
 if(escrowRaw.data.length!==170+escrow.shipEscrowCount*48)throw Error('Unsupported starbase escrow layout.');
 let index=null,beforeEscrow=0n;
 for(let i=0;i<escrow.shipEscrowCount;i++){
  const entry=coder.types.decode('WrappedShipEscrow',escrowRaw.data.subarray(170+i*48,218+i*48));
  if(entry.ship.equals(ship.pubkey)){if(index!==null)throw Error('Duplicate escrow entry.');index=i;beforeEscrow=BigInt(entry.amount.toString());}
  else if(ships.some(s=>s.pubkey.equals(entry.ship)))throw Error('This starbase has an older ship registration. Update it in the official game first.');
 }
 const direct=selected?await directSource(c,owner,mint,amount,sourceTokenAccount):null;
 const tokens=direct?null:await c.getParsedTokenAccountsByOwner(owner,{mint});
 const source=direct||tokens.value.find(t=>{const p=t.account.data.parsed.info;return p.owner===owner.toBase58()&&p.mint===mint.toBase58()&&p.state==='initialized'&&p.tokenAmount.decimals===0&&BigInt(p.tokenAmount.amount)>=BigInt(amount);});
 if(!source)throw Error('No unfrozen wallet token account holds the requested ship quantity.');
 const destination=getAssociatedTokenAddressSync(mint,sageProfile,true);
 const addresses={funder,sagePlayerProfile:sageProfile,originTokenAccount:source.pubkey,ship:ship.pubkey,shipEscrowTokenAccount:destination,starbase,starbasePlayer:basePlayer,key:owner,profile,profileFaction:pda([str('player_faction'),profile.toBuffer()],FACTION),gameId:GAME,gameState:game.gameState,tokenProgram:TOKEN_PROGRAM_ID,systemProgram:SystemProgram.programId};
 const instructions=[ComputeBudgetProgram.setComputeUnitLimit({units:400000}),createAssociatedTokenAccountIdempotentInstruction(funder,destination,sageProfile,mint),depositInstruction(addresses,amount,index)];
 const latest=await c.getLatestBlockhash();
 const tx=new VersionedTransaction(new TransactionMessage({payerKey:funder,recentBlockhash:latest.blockhash,instructions}).compileToV0Message());
 const simulation=await c.simulateTransaction(tx,{sigVerify:false,accounts:{encoding:'base64',addresses:[funder.toBase58()]}});
 if(simulation.value.err)throw Error('Unsigned simulation failed: '+JSON.stringify(simulation.value.err)+'\n'+(simulation.value.logs||[]).slice(-8).join('\n'));
 const after=simulation.value.accounts?.[0]?.lamports;
 if(after===undefined)throw Error('RPC did not return simulated funder balance; cannot review SOL debit.');
 const debit=Math.max(0,funderRaw.lamports-after);
 // A second, separate spend ceiling covers rent/account allocation in addition to fees.
 const maxDebit=debit+200000;
 if(maxDebit>50000000)throw Error('Simulated funding debit exceeds the 0.05 SOL release cap.');
 const textName=a=>Buffer.from(a).toString('utf8').replace(/\0/g,'').trim();
 return {tx,original:Buffer.from(tx.message.serialize()).toString('base64'),latest,owner,funder,mint,amount,profile,starbase,basePlayer,ship:ship.pubkey,source:source.pubkey,beforeSource:direct?direct.amount:source.account.data.parsed.info.tokenAmount.amount,beforeEscrow:beforeEscrow.toString(),maxDebit,summary:{ship:textName(ship.data.name),quantity:amount,mint:mint.toBase58(),shipRegistration:ship.pubkey.toBase58(),sourceTokenAccount:source.pubkey.toBase58(),owner:owner.toBase58(),funder:funder.toBase58(),requiredApprovals:owner.equals(funder)?1:2,playerProfile:profile.toBase58(),starbase:textName(base.name),starbaseAddress:starbase.toBase58(),sector:base.sector.map(n=>n.toString()),starbasePlayer:basePlayer.toBase58(),destination:destination.toBase58(),maximumNetworkFeeSOL:'0.0002',maximumTotalFunderDebitSOL:(maxDebit/1e9).toFixed(9),simulation:'Passed without signatures; not submitted'}};
}
export function verifySigner(tx,key){const i=tx.message.staticAccountKeys.slice(0,tx.message.header.numRequiredSignatures).findIndex(k=>k.equals(key));if(i<0||!nacl.sign.detached.verify(tx.message.serialize(),tx.signatures[i],key.toBytes()))throw Error('Missing or invalid signature for '+key.toBase58());}
export function mergeSecondSignature(first,second,owner,funder){if(!Buffer.from(first.message.serialize()).equals(Buffer.from(second.message.serialize())))throw Error('Funding wallet changed the approved message. Nothing sent; rebuild and sign again.');const i=first.message.staticAccountKeys.findIndex(k=>k.equals(owner));second.signatures[i]=first.signatures[i].slice();verifySigner(second,owner);verifySigner(second,funder);return second;}
export async function signedCheck(c,p){
 verifySigner(p.tx,p.owner);verifySigner(p.tx,p.funder);
 if(await c.getBlockHeight()>p.latest.lastValidBlockHeight)throw Error('Approval expired. Rebuild and sign again.');
 const fee=(await c.getFeeForMessage(p.tx.message)).value;if(fee===null||fee>200000)throw Error('Network fee unavailable or above 0.0002 SOL cap.');
 const before=await c.getBalance(p.funder);
 const sim=await c.simulateTransaction(p.tx,{sigVerify:true,accounts:{encoding:'base64',addresses:[p.funder.toBase58()]}});
 if(sim.value.err)throw Error('Signed simulation failed: '+JSON.stringify(sim.value.err));
 const after=sim.value.accounts?.[0]?.lamports;if(after===undefined||before-after>p.maxDebit)throw Error('Funding debit unavailable or exceeds your reviewed maximum.');
 return {networkFeeSOL:fee/1e9,simulatedFunderDebitSOL:(before-after)/1e9};
}
