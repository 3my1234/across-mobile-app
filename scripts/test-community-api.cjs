const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
let timers=new Map(),timerID=0,calls=[],respond;
const ctx={exports:{},Error,AbortController,require:()=>({API_URL:'https://example.test',AUTH_TIMEOUT_MS:5000}),fetch:async(url,options)=>{calls.push({url,options});return respond();},setTimeout:fn=>{timers.set(++timerID,fn);return timerID;},clearTimeout:id=>timers.delete(id)};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/communityApi.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,ctx);
const request=ctx.exports.communityRequest;
async function main(){
 respond=()=>({status:201,ok:true,headers:{get:()=>null},text:async()=>'{"id":"message"}'});
 assert.equal((await request('buyer','/messages',{method:'POST'})).data.id,'message');assert.equal(timers.size,0);
 respond=()=>({status:201,ok:true,headers:{get:()=>null},text:()=>new Promise(()=>{})});
 const pending=request('buyer','/messages',{method:'POST'});await Promise.resolve();await Promise.resolve();
 for(const fn of [...timers.values()])fn();await assert.rejects(pending,/too long/);
 assert.equal(calls.length,2,'one POST per explicit attempt, no automatic retries');assert.equal(calls[1].options.signal.aborted,true);assert.equal(timers.size,0);
 respond=()=>({status:304,headers:{get:()=> 'tag'},text:()=>{throw Error('304 has no body');}});
 assert.equal((await request('buyer','/messages')).unchanged,true);
 respond=()=>({status:200,ok:true,headers:{get:()=>null},text:async()=>'{truncated'});await assert.rejects(request('buyer','/messages'),/incomplete/);
 respond=()=>({status:403,ok:false,headers:{get:()=>null},text:async()=>'{"message":"Not admitted"}'});await assert.rejects(request('buyer','/messages'),/Not admitted/);
 respond=()=>({status:429,ok:false,headers:{get:name=>name==='Retry-After'?'25':name==='X-Request-ID'?'request-ref':null},text:async()=>'{"error":"Too many requests. Please wait and try again."}'});
 await assert.rejects(request('buyer','/messages',{method:'POST'}),error=>{assert.match(error.message,/Too many requests/);assert.match(error.message,/25 seconds/);assert.equal(error.status,429);assert.equal(error.requestID,'request-ref');return true;});
 respond=()=>({status:500,ok:false,headers:{get:()=>null},text:async()=>'{"error":{"detail":"internal SQL details"}}'});await assert.rejects(request('buyer','/messages',{method:'POST'}),error=>{assert.match(error.message,/message could not be sent/);assert.doesNotMatch(error.message,/SQL|object Object/);return true;});
 respond=()=>({status:500,ok:false,headers:{get:()=>null},text:async()=>'Internal Server Error'});await assert.rejects(request('buyer','/messages',{method:'POST'}),/message could not be sent/);
 assert.equal(timers.size,0);console.log('Community API passed: full body deadline, abort, cleanup, no duplicate mutation, 304, malformed and permission errors.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
