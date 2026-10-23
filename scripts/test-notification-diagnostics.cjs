const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
let hooks=[],index=0,effects=[],tree,changed=false,actor='owner',notification='synthetic-test',received=false,status='pending',fail=0,held,release;
const calls=[],same=(a,b)=>a&&b&&a.length===b.length&&a.every((x,i)=>Object.is(x,b[i]));
const react={createElement:(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity)}),
 useState:value=>{const i=index++;if(!(i in hooks))hooks[i]=value;return [hooks[i],next=>{hooks[i]=typeof next==='function'?next(hooks[i]):next;changed=true;}];},
 useRef:value=>{const i=index++;return hooks[i]||(hooks[i]={current:value});},
 useEffect:(fn,deps)=>{const i=index++;if(!hooks[i]||!same(hooks[i].deps,deps)){const previous=hooks[i];hooks[i]={deps};effects.push(()=>{previous?.cleanup?.();hooks[i].cleanup=fn();});}},
 useCallback:(fn,deps)=>{const i=index++;if(!hooks[i]||!same(hooks[i].deps,deps))hooks[i]={deps,fn};return hooks[i].fn;}};
const context={exports:{},Date,Number,encodeURIComponent,require:name=>{
 if(name==='react')return react;
 if(name==='react-native')return {ActivityIndicator:'Spinner',Pressable:'Button',View:'View'};
 if(name==='./ThemeProvider')return {ThemedText:'Text'};
 if(name==='./AccountDesign')return {useAccountDesign:()=>({}),accountDesign:{}};
 if(name==='./config')return {API_URL:'https://example.test'};
 if(name==='./utils')return {fetchJSONWithTimeout:async(url,options,timeout)=>{calls.push({url,options,timeout});const state=status,code=fail;if(held)await held;return {response:{ok:!code,status:code||200},body:{status:state,updated_at:'2026-10-23T00:00:00Z'}};}};
 throw Error('Unexpected dependency '+name);
}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/NativeNotificationDiagnostics.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText,context);
const nodes=n=>!n||typeof n!=='object'?[]:[n,...(n.children||[]).flatMap(nodes)],text=n=>typeof n==='string'?n:n?.children?.map(text).join('')||'';
function render(){index=0;effects=[];changed=false;tree=context.exports.NativeNotificationDiagnostics({token:actor,notificationId:notification,received});effects.forEach(fn=>fn());}
async function settle(){for(let i=0;i<7;i++){await new Promise(resolve=>setImmediate(resolve));if(changed)render();}}
const button=()=>{const n=nodes(tree).find(n=>n.type==='Button');assert.ok(n);return n;};
(async()=>{
 render();await settle();assert.match(text(tree),/Queued: waiting/);assert.equal(calls[0].options.headers.Authorization,'Bearer owner');assert.equal(calls[0].options.cache,'no-store');assert.equal(calls[0].timeout,10000);
 for(const [value,message] of [['sent',/Push gateway accepted/],['delivered',/does not confirm display or sound/],['retry',/Retry scheduled/],['failed',/Delivery failed/],['disabled',/registration is disabled/]]){status=value;button().props.onPress();await settle();assert.match(text(tree),message);}
 received=true;render();assert.match(text(tree),/app received the test/);
 fail=404;button().props.onPress();await settle();assert.match(text(tree),/tracking is not available/);
 fail=503;button().props.onPress();await settle();assert.match(text(tree),/Retry when connected/);
 fail=0;status='unknown';button().props.onPress();await settle();assert.match(text(tree),/unknown delivery state/);
 status='delivered';held=new Promise(resolve=>{release=resolve;});const count=calls.length;button().props.onPress();button().props.onPress();await settle();assert.equal(calls.length,count+1,'no duplicate refreshes');assert.equal(button().props.disabled,true);
 actor='other-owner';notification='different-test';status='pending';render();release();held=null;await settle();assert.match(text(tree),/Queued: waiting/);assert.doesNotMatch(text(tree),/Phone push service accepted/,'old account response must not appear');
 assert.equal(calls.at(-1).options.headers.Authorization,'Bearer other-owner');hooks.forEach(h=>h?.cleanup?.());
 console.log('Native delivery diagnostics: owned authenticated read, truthful states, no-store, unavailable/failed recovery, no overlap and stale-account protection passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
