import {Buffer} from 'buffer';
import { TransactionMessage, VersionedMessage } from '@solana/web3.js';
const COMPUTE='ComputeBudget111111111111111111111111111111';
const LIGHTHOUSE='L2TExMFKdjpN9kozasaurPirfHy9P8sbXoAN1qA3S95';
const fail=message=>{throw Error(message);};
const normalized=ix=>({program:ix.programId.toBase58(),data:Buffer.from(ix.data).toString('hex'),keys:ix.keys.map(k=>[k.pubkey.toBase58(),k.isSigner,k.isWritable])});
export function validateWalletMessage(originalBase64, message) {
 const original=VersionedMessage.deserialize(Buffer.from(originalBase64,'base64'));
 if((message.addressTableLookups||[]).length)fail('Unexpected address lookup table');
 const before=TransactionMessage.decompile(original),after=TransactionMessage.decompile(message);
 if(!before.payerKey.equals(after.payerKey))fail('Fee payer changed');
 if(before.recentBlockhash!==after.recentBlockhash)fail('Blockhash changed; rebuild approval');
 const signers=m=>m.staticAccountKeys.slice(0,m.header.numRequiredSignatures).map(k=>k.toBase58()).sort().join(',');
 if(signers(original)!==signers(message))fail('Required signers changed');
 const expected=before.instructions.filter(ix=>ix.programId.toBase58()!==COMPUTE).map(normalized);
 const actual=[];let limit=null,price=0n,prices=0,assertions=0;
 const allowedAccounts=new Set(original.staticAccountKeys.map(k=>k.toBase58()));
 for(const ix of after.instructions) {
  const program=ix.programId.toBase58(),data=Buffer.from(ix.data);
  if(program===COMPUTE) {
   if(ix.keys.length)fail('Compute instruction has unexpected accounts');
   if(data[0]===2&&data.length===5&&limit===null){limit=data.readUInt32LE(1);if(limit<1||limit>400000)fail('Compute limit exceeds deposit cap');}
   else if(data[0]===3&&data.length===9&&prices++===0){price=data.readBigUInt64LE(1);}
   else fail('Unexpected or duplicate compute instruction');
  } else if(program===LIGHTHOUSE) {
   // Only read-only assertion variants in the published Lighthouse enum.
   // Never permit MemoryWrite/MemoryClose, new accounts or new permissions.
   if(data.length<2||data[0]<2||data[0]>15||++assertions>8)fail('Unsupported Lighthouse instruction');
   if(ix.keys.some(k=>!allowedAccounts.has(k.pubkey.toBase58())))fail('Lighthouse references an unexpected account');
  } else actual.push(normalized(ix));
 }
 if(JSON.stringify(expected)!==JSON.stringify(actual))fail('Deposit instructions, accounts, permissions or quantity changed');
 // Prevent privilege escalation of ANY original account via an added assertion.
 for(let i=0;i<original.staticAccountKeys.length;i++) {
  const j=message.staticAccountKeys.findIndex(k=>k.equals(original.staticAccountKeys[i]));
  if(j<0||original.isAccountWritable(i)!==message.isAccountWritable(j)||original.isAccountSigner(i)!==message.isAccountSigner(j))fail('Account privileges changed');
 }
 if(limit===null)fail('Missing compute limit');
 const priority=(BigInt(limit)*price+999999n)/1000000n;
 if(priority+10000n>200000n)fail('Total fee exceeds 0.0002 SOL test cap');
 return {lighthouseAssertions:assertions,computeLimit:limit,priorityFeeLamports:priority.toString()};
}

