const fs=require('fs'),vm=require('vm'),ts=require('typescript'),assert=require('node:assert/strict');
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true,target:ts.ScriptTarget.ES2020}}).outputText;
let hooks=[],cursor=0,effects=[],events=[],notify,reads=0;const service={id:'33333333-3333-4333-8333-333333333333',title:'Approved driving',category:'Taxi',status:'approved'};
const react={createElement:(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity)}),useState:value=>{const i=cursor++;if(!(i in hooks))hooks[i]=value;return[hooks[i],next=>hooks[i]=typeof next==='function'?next(hooks[i]):next];},useEffect:(fn,deps)=>{const i=cursor++;if(!hooks[i]||deps.some((d,j)=>d!==hooks[i].deps[j])){effects.push(fn);hooks[i]={deps};}}};
const session={listingID:'',subscribe:fn=>{notify=fn;fn(false,'Offline',false);return()=>{};},start:id=>{events.push('start:'+id);notify(true,'Available nearby',false);return true;},stop:async()=>{events.push('stop');notify(false,'Offline',false);}};
const modules={react,'react-native':{View:'View',Pressable:'Button',ActivityIndicator:'Spinner'},'./ThemeProvider':{ThemedText:'Text'},'./AccountDesign':{useAccountDesign:()=>({})},'./nativeProviderApi':{providerRequest:async()=>{reads++;return {items:[service]};}},'./driverPresenceSession':{providerAvailabilitySession:()=>session},'./transportServices':{transportServiceKind:()=> 'passenger'},'./automaticDriverAvailability':{setAutomaticDriverAvailability:async(_id,on)=>events.push('preference:'+on)}};
const scope={exports:{},URLSearchParams,require:name=>modules[name]};vm.runInNewContext(compile(fs.readFileSync('components/NativeProviderDriver.tsx','utf8')),scope);
function render(){cursor=0;const tree=scope.exports.NativeProviderDriver({token:'driver',providerID:'provider'});while(effects.length)effects.shift()();return tree;}
const nodes=tree=>typeof tree==='object'&&tree?[tree,...(tree.children||[]).flatMap(nodes)]:[];
const text=tree=>typeof tree==='string'?tree:(tree?.children||[]).map(text).join('');
const button=label=>nodes(render()).find(node=>node.type==='Button'&&text(node)===label);
const flush=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
(async()=>{render();await flush();render();const available=button('Available for customers');assert.equal(available.props.disabled,false,'one approved service is preselected');assert.equal(available.props.pressRetentionOffset,0);assert.equal(available.props.hitSlop,0);
 available.props.onPress();await flush();assert.deepEqual(events,['preference:true','start:'+service.id],'availability must not invoke neighboring refresh/offline actions');assert.equal(reads,1);
 button('Go offline').props.onPress();await flush();assert.deepEqual(events.slice(-2),['preference:false','stop']);assert.equal(reads,1);
 button('Refresh services').props.onPress();render();await flush();assert.equal(reads,2);assert.equal(events.length,4,'refresh must not start/stop availability');
 console.log('Actual driver panel passed: automatic service selection, independent neighboring actions, busy state and bounded press areas. Physical Redmi taps remain a device check.');
})().catch(error=>{console.error(error);process.exitCode=1;});
