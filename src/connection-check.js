import {PublicKey} from '@solana/web3.js';
import {TOKEN_PROGRAM_ID} from '@solana/spl-token';
import {mainnet,GAME,SAGE,PROFILE,coder,profileCoder} from './core.js';

// Explicit, read-only, bounded probes. A genesis check alone misses indexed-read restrictions.
export async function checkConnection(c){
 await mainnet(c);
 const game=await c.getAccountInfo(GAME);
 if(!game||!game.owner.equals(SAGE)||coder.accounts.decode('game',game.data).version!==0)throw Error('RPC did not return the supported SAGE game account. Connection not approved.');
 const gameFilter={memcmp:{offset:9,bytes:GAME.toBase58()}};
 const [ships,bases]=await Promise.all([
  c.getProgramAccounts(SAGE,{dataSlice:{offset:0,length:0},filters:[{memcmp:coder.accounts.memcmp('ship')},gameFilter]}),
  c.getProgramAccounts(SAGE,{dataSlice:{offset:0,length:0},filters:[{memcmp:coder.accounts.memcmp('starbase')},gameFilter]}),
  c.getProgramAccounts(PROFILE,{dataSlice:{offset:0,length:0},filters:[{memcmp:profileCoder.accounts.memcmp('profile')},{memcmp:{offset:30,bytes:PublicKey.default.toBase58()}}]}),
  c.getParsedTokenAccountsByOwner(PublicKey.default,{programId:TOKEN_PROGRAM_ID})
 ]);
 if(!ships.length||!bases.length)throw Error('RPC returned no SAGE ships or starbases. Connection not approved; try your provider support.');
 return true;
}

// Manual selection uses only direct reads, never indexed inventory searches.
export async function checkDirectConnection(c){
 await mainnet(c);
 const [game]=await c.getMultipleAccountsInfo([GAME]);
 if(!game||game.executable||!game.owner.equals(SAGE)||coder.accounts.decode('game',game.data).version!==0)throw Error('RPC did not return the supported SAGE game account.');
 const block=await c.getLatestBlockhash();
 if(!block.blockhash||!Number.isSafeInteger(block.lastValidBlockHeight))throw Error('RPC did not return a valid blockhash.');
 return true;
}
