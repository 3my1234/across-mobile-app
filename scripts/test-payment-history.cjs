/* global __dirname */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const ts=require("typescript");
const source=fs.readFileSync(path.join(__dirname,"../components/PaymentHistoryScreen.tsx"),"utf8");
function compile(text,context){vm.runInContext(ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);}
async function main(){
 let list=[],error="",confirmed=0;const calls=[];
 let body={payments:[{id:"b",created_at:"2026-10-06",payment_status:"processing"}],next_cursor:"old|cursor"};
 let responseStatus=200;
 const state={token:"buyer",API_URL:"https://example.test",useCallback:fn=>fn,
  generation:{current:0},verificationGeneration:{current:0},inFlight:{current:false},active:{current:true},rows:{current:[]},nextCursor:{current:""},initialized:{current:false},checking:"",
  setPayments:value=>{list=value;},setLoading:()=>{},setCursor:()=>{},setError:value=>{error=value;},setChecking:()=>{},onConfirmed:async()=>{confirmed++;},
  fetchWithTimeout:async(url,options)=>{calls.push({url,options});assert.equal(options.cache,"no-store");assert.equal(options.headers.Authorization,"Bearer buyer");return {ok:responseStatus<400,status:responseStatus,json:async()=>body};}};
 const context=vm.createContext(state);
 compile(source.slice(source.indexOf("  const load="),source.indexOf("  useEffect(()=>"))+"\nglobalThis.load=load;",context);
 await context.load();assert.equal(list.length,1);
 body={payments:[{id:"a",created_at:"2026-10-05"}],next_cursor:""};await context.load(true);
 assert.match(calls[1].url,/cursor=old%7Ccursor/);assert.equal(list.length,2);
 body={payments:[{id:"b",created_at:"2026-10-06",payment_status:"succeeded"}],next_cursor:"old|cursor"};await context.load();
  assert.equal(list.length,2);assert.equal(list[0].payment_status,"succeeded");
  assert.equal(state.nextCursor.current,"","refresh must not reopen an exhausted older-page cursor");
 responseStatus=500;body={message:"Unavailable"};await context.load();assert.equal(list.length,2);assert.equal(error,"Unavailable");
 compile(source.slice(source.indexOf("  const verify="),source.indexOf("  return <View"))+"\nglobalThis.verify=verify;",context);
 const payment={id:"b",order_id:"saved-order",reference:"ACROSS-saved-reference"};
 responseStatus=202;body={payment_state:"pending"};await context.verify(payment);assert.equal(confirmed,0);assert.match(error,/do not pay again/i);
 const post=calls.find(call=>call.options.method==="POST");assert.ok(post.url.endsWith("/payments/flutterwave/verify"));assert.deepEqual(JSON.parse(post.options.body),{order_id:"saved-order",tx_ref:"ACROSS-saved-reference"});
 responseStatus=200;body={payment_state:"settled"};await context.verify(payment);assert.equal(confirmed,1);
 state.fetchWithTimeout=async()=>{state.active.current=false;return {ok:true,json:async()=>({payment_state:"settled"})};};
 await context.verify(payment);assert.equal(confirmed,1,"unmounted history must not apply a late payment result");
 console.log("Payment history regressions passed: paging, fresh status, retained history, safe verification and unmount protection.");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
