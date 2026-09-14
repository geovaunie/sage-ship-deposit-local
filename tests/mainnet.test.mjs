import test from 'node:test';
import assert from 'node:assert/strict';
import {mainnet} from '../src/core.js';
test('mainnet verification uses the complete independently observed genesis hash',async()=>{
 await mainnet({getGenesisHash:async()=> '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d'});
 await assert.rejects(mainnet({getGenesisHash:async()=> '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'}),/not Solana mainnet/);
 await assert.rejects(mainnet({getGenesisHash:async()=> 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1'}),/not Solana mainnet/);
});
