const fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm'),assert=require('node:assert/strict');
let send,calls=0;
const context={exports:{},AbortController,Promise,Error,JSON,Number,process:{env:{}},setTimeout,clearTimeout,fetch:(...args)=>{calls++;return send(...args);}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/googleSessionRequest.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText,context);
const exchange=context.exports.googleSessionRequest;
(async()=>{
 const signal=new AbortController();let received;
 send=async(_url,options)=>{received=options;return{ok:true,status:200,text:async()=>JSON.stringify({access_token:'synthetic'})};};
 const reply=await exchange('https://synthetic.invalid',{method:'POST',body:'identity'},signal.signal,100);assert.equal(reply.body.access_token,'synthetic');assert.equal(received.method,'POST');
 for(const status of [401,403,503]){calls=0;send=async()=>({ok:false,status,text:async()=> 'Unavailable'});assert.equal((await exchange('https://synthetic.invalid',{method:'POST'},signal.signal,100)).response.status,status);assert.equal(calls,1,'never replay OAuth exchange automatically');}
 calls=0;let nativeSignal;send=async(_url,options)=>{nativeSignal=options.signal;return{ok:true,text:()=>new Promise(()=>{})};};
 await assert.rejects(exchange('https://synthetic.invalid',{},signal.signal,10),/too long/);assert.equal(nativeSignal.aborted,true,'deadline includes response body');assert.equal(calls,1);
 calls=0;const cancelled=new AbortController();cancelled.abort();await assert.rejects(exchange('https://synthetic.invalid',{},cancelled.signal,100),/interrupted/);assert.equal(calls,0);
 const during=new AbortController();send=()=>new Promise(()=>{});const pending=exchange('https://synthetic.invalid',{},during.signal,100);during.abort();await assert.rejects(pending,/interrupted/);
 let configuredBudget;const configured={...context,exports:{},process:{env:{EXPO_PUBLIC_AUTH_TIMEOUT_MS:'25000'}},setTimeout:(fn,ms)=>{configuredBudget=ms;return setTimeout(fn,1);}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/googleSessionRequest.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText,configured);
 await assert.rejects(configured.exports.googleSessionRequest('https://synthetic.invalid',{},signal.signal),/too long/);assert.equal(configuredBudget,25000,'retain the existing configured auth timeout');
 console.log('Google exchange passed: single-shot POST, HTTP rejection, network/body deadline and cancellation without replay.');
})().catch(error=>{console.error(error);process.exitCode=1;});
