import assert from 'node:assert/strict';
import {Keypair,PublicKey,TransactionMessage,TransactionInstruction,ComputeBudgetProgram,SystemProgram} from '@solana/web3.js';
import {validateWalletMessage} from '../src/validate.js';
const funder=Keypair.generate().publicKey,owner=Keypair.generate().publicKey,target=Keypair.generate().publicKey;
const deposit=new TransactionInstruction({programId:new PublicKey('SAGE2HAwep459SNq61LHvjxPk4pLPEJLoMETef7f7EE'),keys:[{pubkey:owner,isSigner:true,isWritable:false},{pubkey:target,isSigner:false,isWritable:true}],data:Buffer.from([1,0,0,0])});
const limit=ComputeBudgetProgram.setComputeUnitLimit({units:400000});
const build=(instructions,payer=funder)=>new TransactionMessage({payerKey:payer,recentBlockhash:PublicKey.default.toBase58(),instructions}).compileToV0Message();
const original=Buffer.from(build([limit,deposit]).serialize()).toString('base64');
const lighthouse=(tag=9,keys=[{pubkey:target,isSigner:false,isWritable:false}])=>new TransactionInstruction({programId:new PublicKey('L2TExMFKdjpN9kozasaurPirfHy9P8sbXoAN1qA3S95'),keys,data:Buffer.from([tag,0,0])});
let count=0;
function pass(ix){validateWalletMessage(original,build(ix));count++;}
function reject(ix,payer){assert.throws(()=>validateWalletMessage(original,build(ix,payer)));count++;}
pass([limit,deposit]);
pass([limit,ComputeBudgetProgram.setComputeUnitPrice({microLamports:375000}),deposit,lighthouse()]);
reject([limit,new TransactionInstruction({...deposit,data:Buffer.from([2,0,0,0])})]);
reject([limit,deposit,SystemProgram.transfer({fromPubkey:funder,toPubkey:target,lamports:1})]);
reject([limit,deposit],owner);
reject([limit,deposit,lighthouse(0)]);
reject([limit,deposit,lighthouse(1)]);
reject([limit,deposit,lighthouse(16)]);
reject([limit,deposit,lighthouse(9,[{pubkey:owner,isSigner:true,isWritable:true}])]);
reject([limit,deposit,lighthouse(9,[{pubkey:Keypair.generate().publicKey,isSigner:false,isWritable:false}])]);
reject([limit,ComputeBudgetProgram.setComputeUnitPrice({microLamports:9999999}),deposit]);
reject([limit,limit,deposit]);
reject([ComputeBudgetProgram.setComputeUnitLimit({units:1400000}),deposit]);
reject([limit]);
console.log(`${count} wallet validation checks passed; no network calls or signing`);

