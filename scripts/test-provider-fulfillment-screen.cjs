const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
let hooks=[],index=0,effects=[],changed=false,tree,alert,held,printed='',status='pending';
const calls=[],same=(a,b)=>a&&b&&a.length===b.length&&a.every((value,i)=>Object.is(value,b[i]));
const react = {
  createElement: (type, props, ...children) => ({type, props: props || {}, children: children.flat(Infinity)}),
  useRef: value => {const i = index++; return hooks[i] || (hooks[i] = {current: value});},
  useState: value => {const i = index++; if (!(i in hooks)) hooks[i] = typeof value === 'function' ? value() : value; return [hooks[i], next => {hooks[i] = typeof next === 'function' ? next(hooks[i]) : next; changed = true;}];},
  useEffect: (fn, deps) => {const i = index++; if (!hooks[i] || !same(hooks[i].deps, deps)) {const previous = hooks[i]; hooks[i] = {deps}; effects.push(() => {previous?.cleanup?.(); hooks[i].cleanup = fn();});}},
  useCallback: (fn, deps) => {const i = index++; if (!hooks[i] || !same(hooks[i].deps, deps)) hooks[i] = {deps, fn}; return hooks[i].fn;},
};

const compile=path=>ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText;
const policy={};vm.runInNewContext(compile('components/providerOrderPolicy.ts'),{exports:policy,URL,Error});
const id='11111111-1111-4111-8111-111111111111',manifest={id,manifest_code:'Synthetic manifest',status:'open',version:1,origin_city:'Lagos',origin_country_code:'NG'};
const request=async(token,path,options={})=>{
 calls.push({token,path,...options});
 if(options.method==='PATCH'){if(held)await held;status='accepted';return {};}
 if(path.includes('merchant-orders'))return {items:[{id,items:[{title:'Saved product',product_snapshot:{image_urls:['https://media.example.test/saved.jpg']}}],package_label:'Synthetic parcel',fulfillment:{route:'merchant_local',owner:'merchant',status,version:1}}]};
 if(path.includes('/manifests/'))return {manifest,items:[{order_id:id,package_code:'Synthetic parcel',product:{title:'<script>bad</script>',image_urls:['https://media.example.test/manifest.jpg']},buyer:{full_name:'Synthetic buyer'}}]};
 return {items:[manifest]};
};
const context={exports:{},URLSearchParams,Error,require:name=>{if(name==='./KeyboardScroll')return {KeyboardScrollView:'Scroll',KeyboardFlatList:'List'};if(name==='./KeyboardFrame')return {KeyboardFrame:'Frame'};
 if(name==='./ProviderPanel')return {ProviderPanel:'Modal'};
 if(name==='react')return react;
 if(name==='react-native')return {ActivityIndicator:'Spinner',Alert:{alert:(...args)=>alert=args},FlatList:'FlatList',Modal:'Modal',Pressable:'Button',ScrollView:'Scroll',Switch:'Switch',View:'View'};
 if(name==='react-native-safe-area-context')return {useSafeAreaInsets:()=>({top:0,bottom:0})};
 if(name==='expo-crypto')return {randomUUID:()=>id};
 if(name==='expo-print')return {printAsync:async({html})=>{printed=html}};
 if(name==='./ThemeProvider')return {ThemedText:'Text',ThemedTextInput:'Input'};
 if(name==='./AccountDesign')return {useAccountDesign:()=>({})};

 if(name==='./ProviderPostImages')return {ProviderPostImages:'Gallery'};
 if(name==='./nativeProviderApi')return {providerRequest:request};
 if(name==='./providerOrderPolicy')return policy;
 throw Error('Unexpected import '+name);
}};
vm.runInNewContext(compile('components/NativeProviderFulfillmentTools.tsx'),context);
function render(){index=0;effects=[];changed=false;tree=context.exports.NativeProviderFulfillmentTools({token:'synthetic-owner',onClose(){}});effects.forEach(fn=>fn());}
async function settle(){for(let i=0;i<10;i++){await new Promise(resolve=>setImmediate(resolve));if(changed)render();}}
function nodes(node){return !node||typeof node!=='object'?[]:[node,...(node.children||[]).flatMap(nodes)];}
const text=node=>typeof node==='string'?node:node?.children?.map(text).join('')||'';
function button(label,root=tree){const result=nodes(root).find(node=>node.type==='Button'&&text(node)===label);assert.ok(result,'missing '+label);return result;}
(async()=>{
 render();await settle();assert.equal(nodes(tree).find(n=>n.type==='Gallery').props.urls[0],'https://media.example.test/saved.jpg');nodes(tree).find(node=>node.type==='Switch').props.onValueChange(true);await settle();
 button('Update selected: accepted').props.onPress();assert.equal(calls.filter(call=>call.method==='PATCH').length,0);
 let release;held=new Promise(resolve=>release=resolve);const confirm=alert[2].find(item=>item.text==='Update orders').onPress;confirm();confirm();await settle();
 const writes=calls.filter(call=>call.method==='PATCH');assert.equal(writes.length,1);assert.equal(writes[0].token,'synthetic-owner');assert.equal(JSON.parse(writes[0].body).orders[0].expected_version,1);
 release();held=null;await settle();assert.equal(status,'accepted');
 button('Manifests').props.onPress();await settle();button('View and print').props.onPress();await settle();
 const list=nodes(tree).find(node=>node.type==='FlatList');assert.ok(list);const manifestRow=list.props.renderItem({item:list.props.data[0]});assert.equal(nodes(manifestRow).find(n=>n.type==='Gallery').props.urls[0],'https://media.example.test/manifest.jpg');const before=calls.length;
 button('Print manifest',list.props.ListHeaderComponent).props.onPress();await settle();assert.equal(calls.length,before+1,'printing must re-fetch owned manifest details');assert.ok(printed.includes('&lt;script&gt;'));assert.ok(!printed.includes('<script>'));
 hooks.forEach(hook=>hook?.cleanup?.());confirm();await settle();assert.equal(calls.filter(call=>call.method==='PATCH').length,1,'a dismissed confirmation cannot write after unmount');
 console.log('Native fulfillment screen passed: confirmed single-flight bulk tracking, versions, owned fresh manifest print and unmounted-action protection.');
})().catch(error=>{console.error(error);process.exitCode=1;});
