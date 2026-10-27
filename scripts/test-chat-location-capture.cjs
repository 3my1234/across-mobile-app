const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;
const load=(file,deps,extra={})=>{const ctx={exports:{},Number,Date,Error,require:n=>deps[n],...extra};vm.runInNewContext(compile(fs.readFileSync(file,'utf8')),ctx);return ctx.exports;};
const maps=load('components/chatLocation.ts',{}),now=1000000,position={timestamp:now,coords:{latitude:9.08,longitude:7.45,accuracy:20}};
let requested;const capture=load('components/chatLocationCapture.ts',{'expo-location':{Accuracy:{High:4}},'./chatLocation':maps,'./foregroundLocation':{currentForegroundLocation:async(...args)=>{requested=args;return position;}}},{Date:{now:()=>now}});
(async()=>{
 const draft=await capture.captureChatLocation();assert.equal(requested[0],undefined,'chat must not use driver/last-known cached callbacks');assert.equal(requested[1].accuracy,4);assert.equal(requested[1].timeoutMs,20000);assert.equal(draft.pin.latitude,9.08);assert.equal(draft.pin.longitude,7.45);assert.equal(draft.capturedAt,now);
 for(const bad of [null,{...position,coords:undefined},{...position,timestamp:now-15001},{...position,timestamp:now+5001},{...position,timestamp:undefined},{...position,coords:{...position.coords,accuracy:4000}},{...position,coords:{...position.coords,accuracy:null}},{...position,coords:{...position.coords,accuracy:-1}},{...position,coords:{...position.coords,accuracy:NaN}},{...position,coords:{...position.coords,latitude:91}},{...position,coords:{...position.coords,longitude:Infinity}}])assert.throws(()=>capture.chatDraftFromGPS(bad,now));
 assert.equal(capture.chatDraftFromGPS({...position,timestamp:now-15000,coords:{...position.coords,accuracy:100}},now).pin.accuracy_m,100);
 assert.equal(capture.chatDraftNeedsRefresh(draft,now+120000),false);assert.equal(capture.chatDraftNeedsRefresh(draft,now+120001),true);
 const manual=capture.chatDraftFromMap({...draft.pin,accuracy_m:4000,extra:'not-wire'},now);assert.equal(manual.source,'map');assert.deepEqual(Object.keys(manual.pin).sort(),['latitude','longitude']);assert.equal(capture.chatDraftNeedsRefresh(manual,now+3600000),false,'manual pickup is a deliberate static destination');assert.throws(()=>capture.chatDraftFromMap({latitude:NaN,longitude:7},now));
 assert.equal(Object.keys(draft.pin).includes('capturedAt'),false,'draft metadata cannot break the existing JSONB wire constraint');
 // Exercise actual acquisition helper, including its unchanged driver defaults.
 let granted=true,held=false,reads=[],timers=new Map(),seq=0;
 const native={Accuracy:{Balanced:3,High:4},getForegroundPermissionsAsync:async()=>({granted}),requestForegroundPermissionsAsync:async()=>({granted:false}),getCurrentPositionAsync:async options=>{reads.push(options);return held?new Promise(()=>{}):position;}};
 const helper=load('components/foregroundLocation.ts',{'expo-location':native},{setTimeout:(fn,ms)=>{const id=++seq;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id)});
 await helper.currentForegroundLocation();assert.equal(reads[0].accuracy,3,'working driver availability keeps Balanced accuracy');assert.equal(timers.size,0);
 await helper.currentForegroundLocation(undefined,{accuracy:4,timeoutMs:20000});assert.equal(reads[1].accuracy,4);assert.equal(timers.size,0);
 const cachedReads=reads.length;await helper.currentForegroundLocation(async()=>position);assert.equal(reads.length,cachedReads,'existing driver callback contract is preserved');
 granted=false;await assert.rejects(()=>helper.currentForegroundLocation(),e=>e.status===403);assert.equal(reads.length,cachedReads);assert.equal(timers.size,0);
 granted=true;held=true;const timeout=helper.currentForegroundLocation(undefined,{accuracy:4,timeoutMs:20000});for(let i=0;i<12;i++)await Promise.resolve();const timer=[...timers.values()].find(t=>t.ms===20000);assert.ok(timer);timer.fn();await assert.rejects(timeout,/timed out/);assert.equal(timers.size,0);
 console.log('Chat GPS capture passed: fresh accurate fixes, high accuracy, bounded timeout/permission refusal, manual point, stale draft policy, unchanged driver defaults and wire compatibility.');
})().catch(error=>{console.error(error);process.exitCode=1;});
