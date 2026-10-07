/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname,'../components/utils.ts'),'utf8');
const code = source.slice(source.indexOf('export function sleep'),source.indexOf('export async function uploadReviewImage'));
async function main() {
 let calls=0, mode='gateway', timers=new Map(), id=0;
 const globals={exports:{},AbortController,Promise,Error,process:{env:{}},
  setTimeout:(callback,ms)=>{const n=++id;timers.set(n,true);if(ms===300 || (mode==='body-timeout' && calls===0))queueMicrotask(()=>{if(timers.delete(n))callback();});return n;},
  clearTimeout:n=>timers.delete(n),
  fetch:async(_url,options)=>{
   calls++; assert.equal(options.cache,'no-store');
   if(mode==='offline')throw new Error('Network request failed');
   if(mode==='body-timeout' && calls===1)return {ok:true,status:200,json:()=>new Promise(()=>{})};
   const status=mode==='denied'?403:mode==='gateway'&&calls===1?503:200;
   return {ok:status===200,status,json:async()=>({items:[{id:'saved'}]})};
  }};
 const context=vm.createContext(globals);vm.runInContext(ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
 const read=context.exports.fetchHistoryJSON;
 let result=await read('https://example.test');assert.equal(calls,2);assert.equal(result.body.items[0].id,'saved');assert.equal(timers.size,0);
 mode='denied';calls=0;result=await read('https://example.test');assert.equal(result.response.status,403);assert.equal(calls,1,'permission errors must not be retried');
 mode='offline';calls=0;await assert.rejects(read('https://example.test'),/conversations have not been removed/);assert.equal(calls,2);assert.equal(timers.size,0);
 mode='body-timeout';calls=0;result=await read('https://example.test');assert.equal(calls,2,'a stalled JSON body must time out and retry');assert.equal(result.body.items[0].id,'saved');assert.equal(timers.size,0);
 calls=0;await assert.rejects(read('https://example.test',{method:'POST'}),/must use GET/);assert.equal(calls,0,'writes must never be replayed');
 console.log('History retries passed: transient gateway/network errors, body deadlines, permission errors, timer cleanup and no mutation replay.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
