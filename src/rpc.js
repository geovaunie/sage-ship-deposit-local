// Never surface a provider's raw error body: it can echo private endpoint keys.
export class RpcError extends Error {
 constructor(message){super(message);this.name='RpcError';}
}
export function rpcFetch(fetcher=(...args)=>globalThis.fetch(...args),timeoutMs=20000,minGapMs=0){
 let queue=Promise.resolve(),lastStarted=0;
 return async (url,options={})=>{
  if(minGapMs){const turn=queue.then(async()=>{const delay=minGapMs-(Date.now()-lastStarted);if(delay>0)await new Promise(resolve=>setTimeout(resolve,delay));lastStarted=Date.now();});queue=turn.catch(()=>{});await turn;}
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
   const response=await fetcher(url,{...options,signal:controller.signal,redirect:'error',credentials:'omit',referrerPolicy:'no-referrer'});
   if(!response.ok){
    const code=response.status;
    if(code===401||code===403)throw new RpcError('RPC access denied (HTTP '+code+'). Check your endpoint key, enabled account/indexed methods, and allowed browser origin in your provider dashboard.');
    if(code===429)throw new RpcError('RPC rate limit reached (HTTP 429). Wait for your provider quota to reset or use an endpoint with sufficient capacity. No automatic retry was made.');
    throw new RpcError('RPC returned HTTP '+code+'. Check your provider dashboard. No automatic retry was made.');
   }
   let body;try{body=await response.clone().json();}catch{throw new RpcError('RPC did not return valid JSON. Use a Solana Mainnet HTTPS RPC endpoint, not a dashboard or explorer link.');}
   if(body?.error)throw new RpcError('RPC rejected the request (code '+(Number.isInteger(body.error.code)?body.error.code:'unknown')+'). This endpoint must support direct account reads, transaction receipts and simulation. Provider error text is hidden to protect endpoint credentials.');
   return response;
  }catch(error){
   if(error instanceof RpcError)throw error;
   throw new RpcError(controller.signal.aborted?'RPC timed out after '+timeoutMs/1000+' seconds. No automatic retry was made.':'RPC could not be reached. Check the URL and internet connection; your provider must allow browser requests from http://127.0.0.1:8787.');
  }finally{clearTimeout(timer);}
 };
}
