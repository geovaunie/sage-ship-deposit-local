import {Buffer} from 'buffer';
import {VersionedTransaction} from '@solana/web3.js';
import bs58 from 'bs58';
import {connection,pk,prepare,verifySigner,mergeSecondSignature,signedCheck,mainnet,CSS_BY_FACTION,resolveProfileInput,findWalletProfiles} from './core.js';
import {validateWalletMessage} from './validate.js';
import {SHIPS} from './catalog.js';
import {checkDirectConnection} from './connection-check.js';
import {RpcError} from './rpc.js';

const $=id=>document.getElementById(id),fields=['owner','funder','rpc','profile','starbase','mint','quantity','shipRegistration','sourceTokenAccount'];
const required=['owner','funder','rpc','profile','starbase','mint','quantity'];
const pendingKey='sage-local-deposit-pending-v1';
let plan=null,c=null,busy=false,stage=0,catalog=null;
let testedRpc='';
let profileLookup={owner:'',rpc:'',before:'',profiles:[],tried:false};
const rpcReady=()=>!!testedRpc&&testedRpc===$('rpc').value.trim();
function requireRpc(){if(!rpcReady())throw Error('The connection changed. Review the deposit again before signing or sending.');}
const short=s=>s?s.slice(0,6)+'…'+s.slice(-6):'Not selected';
const status=text=>{$('status').textContent=text;};
function pending(){const raw=localStorage.getItem(pendingKey);return raw?JSON.parse(raw):null;}
function refresh(){let waiting=true;try{waiting=!!pending();}catch{busy=true;}for(const id of [...fields,'shipChoice','profileChoice'])$(id).disabled=busy||waiting;for(const id of ['connectOwner','connectFunder','prepare','reset','manualPrepare'])$(id).disabled=busy||waiting;$('rpc').disabled=busy;$('ack').disabled=busy||waiting;$('ownerSign').disabled=busy||waiting||stage!==1||!$('ack').checked;$('funderSign').disabled=busy||waiting||stage!==2;$('submit').disabled=busy||waiting||stage!==3;$('check').disabled=busy||!waiting;$('check').hidden=!waiting;$('reset').hidden=stage===0||waiting;
 $('separateFunder').disabled=busy||waiting;$('separateFunderSection').hidden=!$('separateFunder').checked;$('connectFunder').disabled||=!$('separateFunder').checked;
 $('testRpc').disabled=busy;for(const id of ['ownerSign','funderSign','submit'])$(id).disabled||=!rpcReady();
 $('findProfile').disabled=busy||waiting||!$('owner').value;$('playerProfiles').disabled=busy||waiting;
 const ready=required.every(id=>$(id).value.trim());$('prepare').disabled=busy||waiting||!ready;$('manualPrepare').disabled=$('prepare').disabled;
 $('ownerLabel').textContent=$('owner').value?'Ship wallet: '+short($('owner').value):'No wallet connected.';$('funderLabel').textContent=$('funder').value?'Fee wallet: '+short($('funder').value):'No separate fee account selected.';
 $('feeModeStatus').textContent=$('separateFunder').checked?'Optional separate account: select your fee account below.':'Your ship wallet also pays the SOL fees and any required account rent. One wallet approval.';
 const single=plan?.owner.equals(plan.funder);
 const config={1:['Approve with ship wallet',single?'Review this deposit in Phantom using your ship wallet ('+short(plan?.summary.owner)+'). No account switch is needed.':'Switch Phantom back to your ship wallet ('+short(plan?.summary.owner)+'), then approve.','ownerSign'],2:['Approve with fee wallet','Now switch Phantom to your fee wallet ('+short(plan?.summary.funder)+'), then approve.','funderSign'],3:['Send this deposit','The required approval'+(single?'':'s')+' passed the safety checks. This final step submits your deposit.','submit']};
 const next=config[stage];$('next').textContent=next?.[0]||'Approval complete';$('nextHint').textContent=next?.[1]||'';$('next').disabled=!next||$(next[2]).disabled;
 for(let i=1;i<=3;i++)$('step'+i).className=(waiting||stage>0?3:$('owner').value?2:1)===i?'active':'';
 $('statusHeading').textContent=waiting?'Deposit sent · checking status':busy?'Working…':stage>0?'Follow the next approval':'Ready when you are';
}
function clearPlan(){plan=null;stage=0;$('reviewSection').hidden=true;$('ack').checked=false;refresh();}
async function run(action){if(busy)return;busy=true;refresh();try{await action();}catch(e){if(e instanceof RpcError){testedRpc='';$('connectionStatus').textContent='Connection needs attention. Update the RPC settings above and test again.';status(e.message+'\nNo automatic retry or wallet approval was made by the failed RPC request.');}else status(e.message||'Stopped. No automatic retry.');}finally{busy=false;refresh();}}
function resetProfileLookup(){profileLookup={owner:'',rpc:'',before:'',profiles:[],tried:false};$('playerProfiles').replaceChildren();$('playerProfilesLabel').hidden=true;$('findProfile').textContent='Find my profile';$('profileStatus').textContent='Connect your ship wallet to find its profile automatically.';}
function invalidateRpc(){testedRpc='';c=null;resetProfileLookup();clearPlan();$('connectionStatus').textContent='Not tested. Review my deposit tests the connection automatically.';}
async function testDirect(){const url=$('rpc').value.trim();c=connection(url);$('connectionStatus').textContent='Checking mainnet, direct SAGE reads and blockhash access…';await checkDirectConnection(c);if(url!==$('rpc').value.trim())throw Error('RPC changed during testing. Test again.');testedRpc=url;$('connectionStatus').textContent='Direct-read checks passed. Each deposit still requires simulation.';}
$('testRpc').onclick=()=>run(async()=>{invalidateRpc();await testDirect();status('Direct-read connection checks passed. No wallet approval or submission. Find or select your player profile and choose your ship to continue.');});
function wallet(){const p=window.phantom?.solana;if(!p?.isPhantom)throw Error('Phantom was not detected. Open this localhost address in Chrome or Edge with Phantom installed.');return p;}
async function requireAccount(key){requireRpc();const p=wallet();const result=await p.connect();if(!result.publicKey.equals(key))throw Error('Switch Phantom to '+key.toBase58()+' and try this step again.');return p;}
function choices(id,rows,label){const select=$(id);select.replaceChildren();const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Select a ship';select.appendChild(placeholder);for(let i=0;i<rows.length;i++){const option=document.createElement('option');option.value=String(i);option.textContent=label(rows[i]);select.appendChild(option);}select.value='';}
async function lookupProfile(){
 const owner=$('owner').value,url=$('rpc').value.trim();
 if(profileLookup.owner!==owner||profileLookup.rpc!==url)resetProfileLookup();
 profileLookup.owner=owner;profileLookup.rpc=url;profileLookup.tried=true;
 $('profileStatus').textContent='Looking for your profile in up to 12 recent transactions…';
 try{
  const result=await findWalletProfiles(connection(url),pk(owner),{before:profileLookup.before||undefined});
  if(owner!==$('owner').value||url!==$('rpc').value.trim())throw Error('Wallet or connection changed. Find your profile again.');
  profileLookup.before=result.before;profileLookup.profiles=[...new Set([...profileLookup.profiles,...result.profiles])];
  const profiles=profileLookup.profiles;$('playerProfiles').replaceChildren();$('playerProfilesLabel').hidden=profiles.length<2;
  if(profiles.length===1){$('profile').value=profiles[0];$('profileStatus').textContent='Profile found and current wallet authority verified: '+short(profiles[0])+'.';}
  else if(profiles.length>1){
   $('profile').value='';const empty=document.createElement('option');empty.value='';empty.textContent='Choose your player profile';$('playerProfiles').appendChild(empty);
   for(const address of profiles){const option=document.createElement('option');option.value=address;option.textContent=address;$('playerProfiles').appendChild(option);}
   $('playerProfiles').value='';$('profileStatus').textContent='Several profiles were verified. Choose the one for this deposit.';
  }else $('profileStatus').textContent='No supported profile found in this activity. '+(result.before?'Check older activity, or use the transaction-link fallback below.':'The RPC may not retain the needed history. Use a successful SAGE transaction link below.');
  $('findProfile').textContent=result.before?'Check older activity':'Find my profile again';
  status(profiles.length?'Phantom connected. Profile lookup complete. Select your ship and faction CSS, then review the deposit.':'Phantom connected. Profile lookup needs the fallback below; no transaction was signed or sent.');
 }catch(e){
  $('profileStatus').textContent='Automatic lookup is unavailable. Your wallet is still connected. Retry only when ready, or paste a successful SAGE transaction link below.';
  status('Phantom connected. Profile lookup stopped: '+(e instanceof RpcError?e.message:'No verified result available.')+'\nNo signature, submission, or automatic retry.');
 }
}
 $('findProfile').onclick=()=>run(async()=>{if(pending())throw Error('Resolve the pending submission first.');clearPlan();await lookupProfile();});
 $('playerProfiles').onchange=()=>{$('profile').value=$('playerProfiles').value;clearPlan();$('profileStatus').textContent=$('profile').value?'Selected a verified profile. Current authority will be checked again before approval.':'Choose the player profile for this deposit.';};
function selectDestination(){const faction=Number($('profileChoice').value);$('starbase').value=CSS_BY_FACTION[faction]||'';$('destinationLabel').textContent=faction?'Destination: '+['','MUD','ONI','USTUR'][faction]+' CSS · faction will be verified on-chain.':'Select your faction CSS.';}
function selectShip(){const value=$('shipChoice').value,s=value===''?null:SHIPS[Number(value)];$('mint').value=s?.mint||'';$('shipRegistration').value=s?.registration||'';$('sourceTokenAccount').value='';$('quantity').value='1';$('shipAvailable').textContent=s?(s.registration?'Registration hint included; live ownership and quantity checked when you review.':'Catalog selection only—not a balance. Registration will be checked in your existing CSS escrow; Advanced accepts a registration if needed.'):'For an unlisted ship, enter its mint and SAGE registration under Advanced.';clearPlan();}
$('connectOwner').onclick=()=>run(async()=>{if(pending())throw Error('Resolve the pending submission first.');const r=await wallet().connect();const address=r.publicKey.toBase58();clearPlan();if(address!==$('owner').value){$('profile').value='';$('sourceTokenAccount').value='';$('funder').value='';resetProfileLookup();}$('owner').value=address;if(!$('separateFunder').checked)$('funder').value=address;$('chooseSection').hidden=false;status('Phantom connected. Checking for your public player profile. No signing or submission.');if(!profileLookup.tried||profileLookup.owner!==address||profileLookup.rpc!==$('rpc').value.trim())await lookupProfile();});
$('separateFunder').onchange=()=>{if(pending())return;$('funder').value=$('separateFunder').checked?'':$('owner').value;clearPlan();status($('separateFunder').checked?'Optional separate funding selected. Choose another account you own.':'One-wallet mode selected. Your ship wallet will also pay SOL fees and rent.');};
$('connectFunder').onclick=()=>run(async()=>{if(pending())throw Error('Resolve the pending submission first.');if(!$('separateFunder').checked)throw Error('Your ship wallet already pays the fees. A second account is optional.');const r=await wallet().connect();if(r.publicKey.toBase58()===$('owner').value)throw Error('That is still your ship wallet. Turn off the separate-account option to use one wallet, or switch Phantom to another account you own.');$('funder').value=r.publicKey.toBase58();clearPlan();status('Fee account selected. Click Review my deposit to check the ship and SOL cost. No transaction signed.');});
$('profileChoice').onchange=()=>{clearPlan();selectDestination();refresh();};
$('shipChoice').onchange=()=>{selectShip();refresh();};
for(const id of fields)$(id).addEventListener('input',()=>{if(id==='rpc')invalidateRpc();if(id==='mint'){$('shipRegistration').value='';$('shipChoice').value='';}if(id==='owner'){$('profile').value='';$('sourceTokenAccount').value='';$('funder').value=$('separateFunder').checked?'':$('owner').value;resetProfileLookup();}if(id==='profile'){$('playerProfiles').value='';$('profileStatus').textContent='Manual profile or transaction link entered; current authority will be verified when you review.';}clearPlan();status('Selection changed. Any previous unsubmitted approvals were discarded.');});
$('ack').onchange=refresh;
$('prepare').onclick=()=>run(async()=>{
 clearPlan();if(pending())throw Error('Resolve the previous submission before preparing another.');
 if(!$('separateFunder').checked)$('funder').value=$('owner').value;
 if(!required.every(id=>$(id).value.trim()))throw Error('Select a ship, quantity and CSS; verify your Player Profile and connect your wallet. Select a fee account only if you enabled that option.');
 if(!rpcReady())await testDirect();
 const profile=await resolveProfileInput(c,$('profile').value,pk($('owner').value));$('profile').value=profile.toBase58();
 status('Reading on-chain accounts and simulating. No signatures requested.');
 plan=await prepare(c,{owner:pk($('owner').value),funder:pk($('funder').value),profile:pk($('profile').value),starbase:pk($('starbase').value),mint:pk($('mint').value),amount:$('quantity').value.trim(),directMode:true,shipRegistration:$('shipRegistration').value.trim()?pk($('shipRegistration').value):undefined,sourceTokenAccount:$('sourceTokenAccount').value.trim()?pk($('sourceTokenAccount').value):undefined});
 $('review').textContent=JSON.stringify(plan.summary,null,2);$('friendlyReview').replaceChildren();for(const [label,value]of [['Deposit',plan.summary.quantity+' × '+plan.summary.ship],['To',plan.summary.starbase],['Ship wallet',short(plan.summary.owner)],['Fee wallet',short(plan.summary.funder)],['Maximum SOL debit',plan.summary.maximumTotalFunderDebitSOL+' SOL'],['Network fee limit',plan.summary.maximumNetworkFeeSOL+' SOL']]){const row=document.createElement('div');row.className='reviewLine';const title=document.createElement('span'),detail=document.createElement('strong');title.textContent=label;detail.textContent=value;row.appendChild(title);row.appendChild(detail);$('friendlyReview').appendChild(row);}$('reviewSection').hidden=false;stage=1;status('Simulation passed. Check the deposit summary, then follow the wallet approval shown above.');
});
$('manualPrepare').onclick=()=>$('prepare').onclick();
$('next').onclick=()=>{const button={1:'ownerSign',2:'funderSign',3:'submit'}[stage];if(button&&!$(button).disabled)$(button).onclick();};
$('ownerSign').onclick=()=>run(async()=>{
 if(stage!==1||!$('ack').checked||!plan)throw Error('Inspect and review a deposit first.');
 const p=await requireAccount(plan.owner);status('Review the deposit in Phantom. Nothing will be submitted by this signing step.');
 const signed=await p.signTransaction(VersionedTransaction.deserialize(plan.tx.serialize()));
 validateWalletMessage(plan.original,signed.message);verifySigner(signed,plan.owner);plan.tx=signed;
 if(plan.owner.equals(plan.funder)){
  const result=await signedCheck(c,plan);stage=3;
  status('Wallet signature verified. Signed simulation passed.\n'+JSON.stringify(result,null,2)+'\nNot submitted yet. Choose Send this deposit only if this matches your review.');
 }else{
  stage=2;status('Owner signature verified. Now switch Phantom to the separate funding wallet and choose the second signing step.');
 }
});
$('funderSign').onclick=()=>run(async()=>{
 if(stage!==2||!plan)throw Error('Owner signature required first.');const p=await requireAccount(plan.funder);
 status('Funding wallet approval requested. Its message must exactly match the owner-approved message.');
 const signed=await p.signTransaction(VersionedTransaction.deserialize(plan.tx.serialize()));
 plan.tx=mergeSecondSignature(plan.tx,signed,plan.owner,plan.funder);validateWalletMessage(plan.original,plan.tx.message);
 const result=await signedCheck(c,plan);stage=3;status('Both signatures verified. Signed simulation passed.\n'+JSON.stringify(result,null,2)+'\nNot submitted yet. Choose Submit only if this matches your review.');
});
function showLink(signature){$('explorer').href='https://solscan.io/tx/'+encodeURIComponent(signature);$('explorer').hidden=false;}
$('submit').onclick=()=>run(async()=>{
 requireRpc();
 if(stage!==3||!plan||!$('ack').checked)throw Error('All required signatures, a successful signed simulation and your review acknowledgement are required.');
 if(!navigator.locks)throw Error('This browser lacks the local submission lock. Use current Chrome or Edge.');
 await navigator.locks.request('sage-local-deposit-submit',async()=>{
  if(pending())throw Error('A previous submission must be resolved first.');
  validateWalletMessage(plan.original,plan.tx.message);await mainnet(c);await signedCheck(c,plan);
  const bytes=plan.tx.serialize(),signature=bs58.encode(plan.tx.signatures[0]);
  const record={signature,lastValidBlockHeight:plan.latest.lastValidBlockHeight,created:new Date().toISOString()};
  // Persist BEFORE send. An RPC timeout must never trigger a second deposit.
  localStorage.setItem(pendingKey,JSON.stringify(record));showLink(signature);stage=4;
  status('Submission requested. Do not repeat the deposit. Check status using the button below.');
  try{const returned=await c.sendRawTransaction(bytes,{skipPreflight:false,maxRetries:0,preflightCommitment:'confirmed'});if(returned!==signature)throw Error('RPC signature mismatch');status('Sent: '+signature+'\nNot yet confirmed. Use Check submitted transaction.');}
  catch{status('Submission outcome is uncertain. Do not retry or clear browser storage. Use Check submitted transaction or the explorer link.');}
 });
});
$('check').onclick=()=>run(async()=>{
 const record=pending();if(!record)throw Error('No pending submission.');c=connection($('rpc').value);await mainnet(c);showLink(record.signature);
 const result=(await c.getSignatureStatuses([record.signature],{searchTransactionHistory:true})).value[0];
 if(!result){status('No receipt found yet. This is NOT proof the deposit failed. Keep this pending record and check the explorer; do not submit another deposit. Signature: '+record.signature);return;}
 if(result.confirmationStatus!=='finalized'){status('Current status: '+result.confirmationStatus+'. Wait briefly, then check again.');return;}
 if(result.err){localStorage.removeItem(pendingKey);clearPlan();status('Finalized with an error: '+JSON.stringify(result.err)+'. The deposit did not execute; network fees may have been charged.');return;}
 localStorage.removeItem(pendingKey);clearPlan();status('Finalized successfully: '+record.signature+'\nRefresh your starbase inventory in the official game. No further deposit has been prepared.');
});
$('reset').onclick=()=>{if(pending()){status('Resolve the pending submission first.');return;}clearPlan();status('Unsubmitted approvals discarded. Already-signed messages cannot be revoked, but this app has not sent them.');};
window.addEventListener('storage',()=>refresh());
$('rpc').value='https://rpc.solanatracker.io/public';
choices('shipChoice',SHIPS,s=>s.name);$('shipChoice').value='';
$('profileChoice').value='';
try{const r=pending();if(r){showLink(r.signature);status('A previous submission is unresolved. Check its status before any new deposit. Signature: '+r.signature);}refresh();}catch{busy=true;status('Local storage is unavailable or corrupt. Submission is disabled to prevent duplicate deposits.');refresh();}
// Optional agent-readable status only. Never expose signing or submission as an agent tool.
try{const context=document.modelContext;if(context?.registerTool){const lifecycle=new AbortController();Promise.resolve(context.registerTool({name:'read_deposit_status',description:'Read the visible deposit status; does not connect, sign, submit, or request RPC data.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute(input){if(!input||Object.keys(input).length)throw Error('Expected an empty object.');return {stage,status:$('status').textContent};}},{signal:lifecycle.signal})).catch(()=>{});window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});}}catch{}
