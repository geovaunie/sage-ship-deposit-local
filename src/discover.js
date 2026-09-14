import {Buffer} from 'buffer';
import {PublicKey} from '@solana/web3.js';
import {BorshCoder} from '@staratlas/anchor';
import {IDL} from '@staratlas/profile-faction/dist/src/idl/profile_faction.js';
import {TOKEN_PROGRAM_ID} from '@solana/spl-token';
import {SAGE,GAME,PROFILE,FACTION,coder,profileCoder,profileHasOwner,mainnet} from './core.js';
const factionCoder=new BorshCoder(IDL);
const name=a=>Buffer.from(a).toString('utf8').replace(/\0/g,'').trim();
const derive=(seeds,program=SAGE)=>PublicKey.findProgramAddressSync(seeds,program)[0];
const valid=(raw,program)=>raw?.owner.equals(program)&&!raw.executable;
export async function discover(c,owner,profileHint=''){
 await mainnet(c);
 // Filtered key-zero lookup: no unbounded download of all player profiles.
 // Profiles whose owner is in another key slot can use the Advanced hint.
 const profilesPromise=profileHint?c.getAccountInfo(new PublicKey(profileHint)).then(account=>account?[{pubkey:new PublicKey(profileHint),account}]:[]):c.getProgramAccounts(PROFILE,{filters:[{memcmp:profileCoder.accounts.memcmp('profile')},{memcmp:{offset:30,bytes:owner.toBase58()}}]});
 const [candidates,tokens,shipRows,baseRows]=await Promise.all([profilesPromise,c.getParsedTokenAccountsByOwner(owner,{programId:TOKEN_PROGRAM_ID}),c.getProgramAccounts(SAGE,{filters:[{memcmp:coder.accounts.memcmp('ship')},{memcmp:{offset:9,bytes:GAME.toBase58()}}]}),c.getProgramAccounts(SAGE,{filters:[{memcmp:coder.accounts.memcmp('starbase')},{memcmp:{offset:9,bytes:GAME.toBase58()}}]})]);
 const profiles=candidates.filter(row=>{try{return valid(row.account,PROFILE)&&profileHasOwner(row.account.data,owner);}catch{return false;}});
 if(!profiles.length)throw Error('No supported game profile was found for this wallet. Choose your main game account in Phantom, or enter your Player Profile under Advanced and try again.');
 if(profiles.length>20)throw Error('Several profiles found. Enter one Player Profile under Advanced to narrow the search.');
 const factionKeys=profiles.map(p=>derive([Buffer.from('player_faction'),p.pubkey.toBuffer()],FACTION));
 const factions=await c.getMultipleAccountsInfo(factionKeys);
 const bases=baseRows.filter(r=>valid(r.account,SAGE)).map(r=>({...r,data:coder.accounts.decode('starbase',r.account.data)})).filter(r=>r.data.version===0&&r.data.gameId.equals(GAME)&&r.data.level>=6);
 const options=[];
 for(let i=0;i<profiles.length;i++){
  const raw=factions[i];if(!valid(raw,FACTION))continue;
  const faction=factionCoder.accounts.decode('profileFactionAccount',raw.data);
  if(faction.version!==0||!faction.profile.equals(profiles[i].pubkey)||![1,2,3].includes(faction.faction))continue;
  const matching=bases.filter(b=>b.data.faction===faction.faction);
  for(const base of matching){
   const sage=derive([Buffer.from('sage_player_profile'),profiles[i].pubkey.toBuffer(),GAME.toBuffer()]);
   const seq=Buffer.alloc(2);seq.writeUInt16LE(base.data.seqId);
   options.push({profile:profiles[i].pubkey.toBase58(),faction:['Unaligned','MUD','ONI','USTUR'][faction.faction],starbase:base.pubkey.toBase58(),name:name(base.data.name),basePlayer:derive([Buffer.from('starbase_player'),base.pubkey.toBuffer(),sage.toBuffer(),seq])});
  }
 }
 const registrations=options.length?await c.getMultipleAccountsInfo(options.map(o=>o.basePlayer)):[];
 const destinations=options.filter((o,i)=>{try{if(!valid(registrations[i],SAGE))return false;const p=coder.accounts.decode('starbasePlayer',registrations[i].data);return p.version===0&&p.playerProfile.toBase58()===o.profile&&p.gameId.equals(GAME)&&p.starbase.toBase58()===o.starbase;}catch{return false;}});
 if(!destinations.length)throw Error('Your faction CSS registration was not found. Register there in the official game first. No deposit was prepared.');
 const holdings=new Map();
 for(const t of tokens.value){const p=t.account.data?.parsed?.info;if(!t.account.owner?.equals(TOKEN_PROGRAM_ID)||p?.owner!==owner.toBase58()||p.state!=='initialized'||p.tokenAmount?.decimals!==0)continue;const amount=BigInt(p.tokenAmount.amount);if(amount>(holdings.get(p.mint)||0n))holdings.set(p.mint,amount);}
 const current=new Map();
 for(const r of shipRows){if(!valid(r.account,SAGE))continue;const s=coder.accounts.decode('ship',r.account.data);if(s.version!==0||!s.gameId.equals(GAME)||!s.next.key.equals(PublicKey.default))continue;const mint=s.mint.toBase58();if(current.has(mint))current.set(mint,null);else current.set(mint,s);}
 const ships=[...holdings.entries()].filter(([mint,amount])=>amount>0n&&current.get(mint)).map(([mint,amount])=>({mint,name:name(current.get(mint).name),available:amount.toString()})).sort((a,b)=>a.name.localeCompare(b.name));
 return {destinations,ships};
}
