const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
let calls=[],outcome={response:{status:201},body:{ticket_id:'11111111-1111-4111-8111-111111111111'}};
const context={exports:{},require:name=>name==='./config'?{API_URL:'https://synthetic.invalid'}:name==='./utils'?{fetchJSONWithTimeout:async(...args)=>{calls.push(args);if(outcome instanceof Error)throw outcome;return outcome;}}:(()=>{throw Error(name)})()};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/accountDeletionTransport.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,context);
(async()=>{
 const send=context.exports.requestAccountDeletion;
 await assert.rejects(()=>send('','DELETE'));await assert.rejects(()=>send('synthetic-session','YES'));assert.equal(calls.length,0);
 assert.equal(await send('synthetic-session','DELETE'),'11111111-1111-4111-8111-111111111111');
 const [url,options,timeout]=calls[0];assert.equal(url,'https://synthetic.invalid/api/v1/support/tickets');assert.equal(options.method,'POST');assert.equal(options.headers.Authorization,'Bearer synthetic-session');assert.equal(timeout,15000);
 const payload=JSON.parse(options.body);assert.deepEqual(Object.keys(payload).sort(),['message','subject']);assert.match(payload.message,/linked to this account/);
 for(const result of [new Error('timeout'),{response:{status:401},body:{}},{response:{status:500},body:{}},{response:{status:201},body:{ticket_id:'untrusted-value'}}]){
  outcome=result;const before=calls.length;await assert.rejects(()=>send('synthetic-session','DELETE'));assert.equal(calls.length,before+1,'uncertain mutation must not be automatically replayed');
 }
 console.log('Deletion request: authenticated ownership, confirmation, acknowledgement and no automatic replay PASS. Fulfilment/web policy remains a separate gate.');
})().catch(e=>{console.error(e);process.exitCode=1;});
