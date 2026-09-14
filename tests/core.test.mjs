import test from 'node:test';
import assert from 'node:assert/strict';
import {Keypair,PublicKey,TransactionMessage,VersionedTransaction,ComputeBudgetProgram,Connection} from '@solana/web3.js';
import {Program,BN} from '@staratlas/anchor';
import {IDL} from '@staratlas/sage/dist/src/idl/sage.js';
import {SagePlayerProfile} from '@staratlas/sage';
import {SAGE,depositInstruction,quantity,profileCoder,profileHasOwner,mergeSecondSignature,verifySigner,connection} from '../src/core.js';
const owner=Keypair.generate(),funder=Keypair.generate();
const names=['sagePlayerProfile','originTokenAccount','ship','shipEscrowTokenAccount','starbase','starbasePlayer','profile','profileFaction','gameId','gameState'];
const a=Object.fromEntries(names.map(n=>[n,Keypair.generate().publicKey]));
a.funder=funder.publicKey;a.key=owner.publicKey;a.tokenProgram=new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');a.systemProgram=PublicKey.default;
const program=new Program(IDL,SAGE,{connection:new Connection('https://api.mainnet-beta.solana.com')});
for(const index of [null,0,23])test('instruction matches official SDK: index '+index,async()=>{
 const signer=key=>({publicKey:()=>key});
 const result=await SagePlayerProfile.addShipEscrow(program,a.profile,a.profileFaction,a.sagePlayerProfile,signer(a.key),a.originTokenAccount,a.ship,a.shipEscrowTokenAccount,a.starbasePlayer,a.starbase,a.gameId,a.gameState,{shipAmount:new BN('12'),index})(signer(a.funder));
 const actual=depositInstruction(a,'12',index),expected=result[0].instruction;
 assert.deepEqual(actual.data,expected.data);assert.deepEqual(actual.keys,expected.keys);assert.ok(actual.programId.equals(expected.programId));
});
test('quantity and endpoint restrictions',()=>{for(const q of ['0','-1','1.2','1e3',' 1','18446744073709551616'])assert.throws(()=>quantity(q));assert.equal(quantity('18446744073709551615'),'18446744073709551615');assert.throws(()=>connection('http://localhost'));assert.throws(()=>connection('https://user:pass@example.com'));});
async function profileBytes(scope,expires=-1,permissions=1,threshold=1){const head=await profileCoder.accounts.encode('profile',{version:0,authKeyCount:1,keyThreshold:threshold,nextSeqId:new BN(0),createdAt:new BN(0)});const key=profileCoder.types.encode('ProfileKey',{key:owner.publicKey,scope,expireTime:new BN(expires),permissions:[permissions,0,0,0,0,0,0,0]});return Buffer.concat([head,Buffer.from([1,0]),key]);}
test('profile primary authority only',async()=>{const scope=new PublicKey('pprofELXjL5Kck7Jn5hCpwAL82DpTkSYBENzahVtbc9');assert.equal(profileHasOwner(await profileBytes(scope),owner.publicKey),true);assert.equal(profileHasOwner(await profileBytes(PublicKey.default),owner.publicKey),false);assert.equal(profileHasOwner(await profileBytes(scope,1),owner.publicKey),false);assert.equal(profileHasOwner(await profileBytes(scope,-1,0),owner.publicKey),false);assert.throws(()=>profileHasOwner(awaitUnused(),owner.publicKey));assert.throws(()=>profileHasOwner(Buffer.alloc(5),owner.publicKey));});
function awaitUnused(){return Buffer.alloc(30);}
const make=()=>new VersionedTransaction(new TransactionMessage({payerKey:funder.publicKey,recentBlockhash:PublicKey.default.toBase58(),instructions:[ComputeBudgetProgram.setComputeUnitLimit({units:400000}),depositInstruction(a,'1',null)]}).compileToV0Message());
test('second wallet signature preserves verified first signature',()=>{const first=make();first.sign([owner]);const second=make();second.sign([funder]);const merged=mergeSecondSignature(first,second,owner.publicKey,funder.publicKey);verifySigner(merged,owner.publicKey);verifySigner(merged,funder.publicKey);});
test('reject invalid or changed wallet signatures',()=>{const first=make();first.sign([owner]);assert.throws(()=>mergeSecondSignature(first,make(),owner.publicKey,funder.publicKey));const second=make();second.message.recentBlockhash=Keypair.generate().publicKey.toBase58();second.sign([funder]);assert.throws(()=>mergeSecondSignature(first,second,owner.publicKey,funder.publicKey));});
