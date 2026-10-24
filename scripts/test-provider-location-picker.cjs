const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
let hooks=[],index=0,effects=[],tree,changed=false,chosen=[],closed=0,searchCalls=0,release,lookup;
const same=(a,b)=>a&&b&&a.length===b.length&&a.every((x,i)=>Object.is(x,b[i]));
const react={createElement:(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity)}),
 useState:value=>{const i=index++;if(!(i in hooks))hooks[i]=typeof value==='function'?value():value;return [hooks[i],next=>{hooks[i]=typeof next==='function'?next(hooks[i]):next;changed=true;}];},
 useRef:value=>{const i=index++;return hooks[i]||(hooks[i]={current:value});},
 useEffect:(fn,deps)=>{const i=index++;if(!hooks[i]||!same(hooks[i].deps,deps)){const previous=hooks[i];hooks[i]={deps};effects.push(()=>{previous?.cleanup?.();hooks[i].cleanup=fn();});}}};
const context={exports:{},Number,setTimeout:()=>1,clearTimeout:()=>{},require:name=>{
 if(name==='react')return react;
 if(name==='react-native')return {ActivityIndicator:'Spinner',Keyboard:{dismiss(){}},Modal:'Modal',Pressable:'Button',ScrollView:'Scroll',View:'View',StyleSheet:{create:x=>x}};
 if(name==='@maplibre/maplibre-react-native')return {MapView:'Map',Camera:'Camera',PointAnnotation:'Pin'};
 if(name==='react-native-safe-area-context')return {useSafeAreaInsets:()=>({top:0,bottom:16})};
 if(name==='./ThemeProvider')return {ThemedText:'Text',ThemedTextInput:'Input'};
 if(name==='./AccountDesign')return {useAccountDesign:()=>({})};
 if(name==='./foregroundLocation')return {currentForegroundLocation:async()=>({coords:{latitude:7,longitude:4}})};
 if(name==='./providerAddressSearch')return {providerAddressSearch:async()=>{searchCalls++;return lookup?lookup:[{latitude:6,longitude:3}];}};
 throw Error('Unexpected dependency '+name);
}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/NativeProviderLocationPicker.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText,context);
const {NativeProviderLocationPicker:Picker,validProviderPin}=context.exports;
function render(){index=0;effects=[];changed=false;tree=Picker({onChoose:pin=>chosen.push(pin),onClose:()=>closed++});effects.forEach(fn=>fn());}
const nodes=n=>!n||typeof n!=='object'?[]:[n,...(n.children||[]).flatMap(nodes)],text=n=>typeof n==='string'?n:n?.children?.map(text).join('')||'';
const node=type=>{const n=nodes(tree).find(n=>n.type===type);assert.ok(n,type);return n;};
const button=label=>{const n=nodes(tree).find(n=>n.type==='Button'&&text(n)===label);assert.ok(n,label);return n;};
async function settle(){for(let i=0;i<5;i++){await new Promise(resolve=>setImmediate(resolve));if(changed)render();}}
const point=(longitude,latitude)=>({geometry:{type:'Point',coordinates:[longitude,latitude]}});
(async()=>{
 assert.equal(validProviderPin({latitude:null,longitude:3}),false);assert.equal(validProviderPin({latitude:NaN,longitude:3}),false);assert.equal(validProviderPin({latitude:91,longitude:3}),false);
 render();assert.equal(button('Use this location').props.disabled,true,'default viewport is not a selected location');
 assert.equal(node('Map').props.attributionEnabled,true);node('Map').props.onPress(point(3,6));await settle();assert.equal(chosen.length,0,'map movement must not save');
 assert.deepEqual(Array.from(node('Pin').props.coordinate),[3,6]);assert.equal(node('Pin').props.draggable,true);
 node('Pin').props.onDragEnd(point(4,7));await settle();assert.deepEqual(Array.from(node('Pin').props.coordinate),[4,7]);
 node('Map').props.onPress(point(500,8));await settle();assert.deepEqual(Array.from(node('Pin').props.coordinate),[4,7],'invalid events cannot replace selected location');
 node('Map').props.onDidFailLoadingMap();await settle();assert.match(text(tree),/manual coordinates/);button('Retry map').props.onPress();await settle();
 lookup=new Promise(resolve=>{release=resolve;});node('Input').props.onChangeText('Synthetic city');await settle();button('Search address').props.onPress();button('Search address').props.onPress();await settle();assert.equal(searchCalls,1);
 button('Cancel').props.onPress();release([{latitude:9,longitude:5}]);await settle();assert.equal(closed,1);assert.equal(chosen.length,0,'cancelled async search cannot commit');
 hooks.forEach(h=>h?.cleanup?.());hooks=[];render();button('Use GPS').props.onPress();await settle();assert.deepEqual(Array.from(node('Pin').props.coordinate),[4,7]);
 button('Use this location').props.onPress();button('Use this location').props.onPress();assert.equal(chosen.length,1,'confirmation emits one result');assert.equal(chosen[0].latitude,7);assert.equal(chosen[0].longitude,4);
 hooks.forEach(h=>h?.cleanup?.());console.log('Native map component: explicit selection, validated tap/drag, attribution, retry, GPS, single-flight search, cancellation and single confirmation passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
