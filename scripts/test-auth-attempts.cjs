const fs=require('node:fs'), vm=require('node:vm'), ts=require('typescript'), assert=require('node:assert/strict');
const context={exports:{},AbortController,Promise,Date,Number,Error};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/authAttempts.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,context);
const {createAuthAttempts,createSessionPersistence}=context.exports;
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const session=name=>({access_token:name,expires_at:Math.floor(Date.now()/1000)+3600});
function storage(){
 const values={},opened=[],holds=[];let hold=null,fail=null;
 async function write(key,value){if(hold===key||(hold==='final-expiry'&&key==='expiry'&&value!=='0')){hold=null;await new Promise(resolve=>holds.push(resolve));}if(fail===key){fail=null;throw Error('storage unavailable');}values[key]=value;}
 const persistence=createSessionPersistence({token:value=>write('token',value),expiry:value=>write('expiry',value),clear:async()=>{delete values.token;delete values.expiry;},open:s=>opened.push(s.access_token)});
 return {persistence,values,opened,hold:key=>hold=key,fail:key=>fail=key,release:()=>holds.shift()()};
}
(async()=>{
 const gate=createAuthAttempts(),first=gate.begin();assert.ok(first);assert.equal(gate.begin(),null,'rapid tap / competing signup / OAuth cannot reserve another slot');
 gate.cancel();assert.equal(first.signal.aborted,true);assert.equal(first.current(),false);
 const next=gate.begin();first.finish();assert.equal(gate.pending,true,'stale finally cannot release newer owner');assert.ok(next.current());next.finish();assert.equal(gate.pending,false);
 for(const held of ['token','expiry','final-expiry']){
  const state=storage(),attempts=createAuthAttempts(),old=attempts.begin();state.hold(held);
  const oldCommit=state.persistence.commit(session('old'),old.current);await flush();attempts.cancel();
  const replacement=attempts.begin();const newCommit=state.persistence.commit(session('new'),replacement.current);
  state.release();assert.equal(await oldCommit,false);assert.equal(await newCommit,true);
  assert.equal(state.values.token,'new');assert.deepEqual(state.opened,['new']);
 }
 const logout=storage();logout.hold('token');const pending=logout.persistence.commit(session('old'));await flush();const cleared=logout.persistence.clear();logout.release();assert.equal(await pending,false);await cleared;assert.deepEqual(logout.values,{});assert.deepEqual(logout.opened,[]);
 const switching=storage();switching.hold('token');const old=switching.persistence.commit(session('old'));await flush();const clear=switching.persistence.clear(),newer=switching.persistence.commit(session('new'));switching.release();assert.equal(await old,false);await clear;assert.equal(await newer,true);assert.equal(switching.values.token,'new');assert.deepEqual(switching.opened,['new']);
 for(const field of ['token','expiry']){const failing=storage();failing.fail(field);await assert.rejects(failing.persistence.commit(session('bad')),/storage unavailable/);assert.deepEqual(failing.opened,[]);assert.deepEqual(failing.values,{});assert.equal(await failing.persistence.commit(session('recovered')),true);}
 for(const bad of [{access_token:'',expires_at:Date.now()}, {access_token:'x',expires_at:'NaN'}, {access_token:'x',expires_at:1}]){const invalid=storage();await assert.rejects(invalid.persistence.commit(bad),/invalid session/);assert.deepEqual(invalid.values,{});}
 let resume;const shared={},opens=[];
 const ports={token:async value=>{if(value==='old-mount')await new Promise(r=>resume=r);shared.token=value;},expiry:async value=>{shared.expiry=value;},clear:async()=>{delete shared.token;delete shared.expiry;},open:value=>opens.push(value.access_token)};
 const oldMount=createSessionPersistence(ports),oldWrite=oldMount.commit(session('old-mount'));await flush();
 const newMount=createSessionPersistence(ports),restored=newMount.read(async()=>({...shared})),newWrite=newMount.commit(session('new-mount'));resume();
 assert.equal(await oldWrite,false);assert.deepEqual(await restored,{});assert.equal(await newWrite,true);assert.equal(shared.token,'new-mount');assert.deepEqual(opens,['new-mount']);
 const never=storage();assert.equal(await never.persistence.commit(session('stale'),()=>false),false);assert.deepEqual(never.values,{});
 console.log('Auth coordination passed: synchronous exclusion, cancellation, stale finally, storage-stage cancellation, logout/new-account ordering, storage failures and invalid-session rejection.');
})().catch(e=>{console.error(e);process.exitCode=1;});
