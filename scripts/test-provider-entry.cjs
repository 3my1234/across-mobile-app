const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const compile=code=>ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText;
let hooks=[],index=0,effects=[],changed=false,tree,token='owner',intent='auto',status=200,account={id:'provider',is_active:true},held,release,pendingProvider=false,profileEmail='applicant@example.test';
const resolved=[],calls=[],same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
const react={createElement:(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity)}),
 useState:value=>{const i=index++;if(!(i in hooks))hooks[i]=typeof value==='function'?value():value;return [hooks[i],next=>{hooks[i]=typeof next==='function'?next(hooks[i]):next;changed=true;}];},
 useRef:value=>{const i=index++;return hooks[i]||(hooks[i]={current:value});},
 useEffect:(fn,deps)=>{const i=index++;if(!hooks[i]||!same(hooks[i].deps,deps)){const old=hooks[i];hooks[i]={deps};effects.push(()=>{old?.cleanup?.();hooks[i].cleanup=fn();});}},
 useCallback:(fn,deps)=>{const i=index++;if(!hooks[i]||!same(hooks[i].deps,deps))hooks[i]={deps,fn};return hooks[i].fn;}};
class ProviderRequestError extends Error{constructor(status){super('Synthetic HTTP failure');this.status=status;}}
const context={exports:{},require:name=>{
 if(name==='react')return react;
 if(name==='react-native')return {ActivityIndicator:'Spinner',Pressable:'Button',View:'View'};
 if(name==='react-native-safe-area-context')return {useSafeAreaInsets:()=>({top:0,bottom:10})};
 if(name==='./ThemeProvider')return {ThemedText:'Text'};
 if(name==='./AccountDesign')return {useAccountDesign:()=>({}),accountDesign:{}};
 if(name==='./workspaceIntent')return {hasPendingProviderSignup:async()=>pendingProvider,signupWorkspaceFor:async email=>email==='applicant@example.test'?'provider':'auto'};
 if(name==='./nativeProviderApi')return {ProviderRequestError,providerRequest:async(actor,path)=>{calls.push({actor,path});if(path==='/profile')return {email:profileEmail};const code=status,value=account;if(held)await held;if(code!==200)throw new ProviderRequestError(code);return value;}};
 throw Error('Unexpected import '+name);
}};
vm.runInNewContext(compile(fs.readFileSync('components/ProviderEntryGate.tsx','utf8')),context);
function render(){index=0;effects=[];changed=false;tree=context.exports.ProviderEntryGate({token,intent,onResolved:value=>resolved.push(value)});effects.forEach(fn=>fn());}
async function settle(){for(let i=0;i<6;i++){await new Promise(resolve=>setImmediate(resolve));if(changed)render();}}
function reset(){hooks.forEach(h=>h?.cleanup?.());hooks=[];resolved.length=0;calls.length=0;held=null;pendingProvider=false;profileEmail='applicant@example.test';intent='auto';status=200;account={id:'provider',is_active:true};}
const nodes=n=>!n||typeof n!=='object'?[]:[n,...(n.children||[]).flatMap(nodes)],text=n=>typeof n==='string'?n:n?.children?.map(text).join('')||'';
function button(label){const n=nodes(tree).find(n=>n.type==='Button'&&text(n)===label);assert.ok(n,label);return n;}
(async()=>{
 render();await settle();assert.deepEqual(resolved,[true]);assert.equal(calls[0].path,'/providers/me');assert.equal(calls[0].actor,'owner');
 reset();account={id:'provider',is_active:false,subscription:{status:'expired'}};render();await settle();assert.deepEqual(resolved,[true],'restricted/expired providers still get their workspace; API enforces restrictions');
 reset();status=404;render();await settle();assert.deepEqual(resolved,[false],'only definitive no-provider response chooses customer automatically');
 reset();status=404;pendingProvider=true;render();await settle();assert.deepEqual(resolved,[true],'verified applicant returns to provider onboarding after app restart');assert.equal(calls[1].path,'/profile');
 reset();status=404;pendingProvider=true;profileEmail='different@example.test';render();await settle();assert.deepEqual(resolved,[false],'pending provider journey cannot cross authenticated accounts');
 for(const code of [401,403,429,500]){reset();status=code;render();await settle();assert.deepEqual(resolved,[],'failure must not be treated as missing provider');assert.match(text(tree),/could not check/);status=200;button('Retry account access').props.onPress();button('Retry account access').props.onPress();await settle();assert.deepEqual(resolved,[true]);assert.equal(calls.length,2,'retry is single-flight');}
 reset();intent='provider';status=404;render();await settle();assert.deepEqual(resolved,[true],'provider signup opens onboarding even without an organization');assert.equal(calls.length,0);
 reset();intent='customer';render();await settle();assert.deepEqual(resolved,[false]);assert.equal(calls.length,0);
 reset();held=new Promise(resolve=>{release=resolve;});render();hooks.forEach(h=>h?.cleanup?.());release();await settle();assert.deepEqual(resolved,[],'late account result after unmount cannot navigate');
 reset();account={};render();await settle();assert.deepEqual(resolved,[],'malformed responses are errors, not customer accounts');button('Continue as customer').props.onPress();button('Open provider workspace').props.onPress();assert.deepEqual(resolved,[false],'explicit fallback can resolve once only');
 let stored=null;const secure={setItemAsync:async(_,value)=>{stored=value;},getItemAsync:async()=>stored,deleteItemAsync:async()=>{stored=null;}};
 const saved={exports:{},require:name=>{assert.equal(name,'expo-secure-store');return secure;}};vm.runInNewContext(compile(fs.readFileSync('components/workspaceIntent.ts','utf8')),saved);
 await saved.exports.rememberSignupWorkspace(' New@Example.test ','provider');assert.equal(await saved.exports.signupWorkspaceFor('new@example.test'),'provider');assert.equal(await saved.exports.signupWorkspaceFor('another@example.test'),'auto','pending signup intent cannot cross accounts');
 assert.equal(await saved.exports.hasPendingProviderSignup(),true);stored='malformed';assert.equal(await saved.exports.hasPendingProviderSignup(),false);assert.equal(await saved.exports.signupWorkspaceFor('new@example.test'),'auto');await saved.exports.clearSignupWorkspace();assert.equal(stored,null);
 const app=fs.readFileSync('App.tsx','utf8');assert.match(app,/ProviderEntryGate key=\{token\}/);assert.match(app,/workspaceEntryToken !== token/);assert.match(app,/accessibilityLabel="Open provider workspace"/);assert.doesNotMatch(app,/accessibilityLabel="Switch to provider workspace"/);
 const ast=ts.createSourceFile('App.tsx',app,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let entryCallback;
 function visit(node){if(ts.isJsxSelfClosingElement(node)&&node.tagName.getText(ast)==='ProviderEntryGate'){const attribute=node.attributes.properties.find(p=>p.name?.getText(ast)==='onResolved');entryCallback=attribute.initializer.expression.getText(ast);}ts.forEachChild(node,visit);}visit(ast);assert.ok(entryCallback);
 const navigation={token:'owner',sessionTokenRef:{current:'owner'},notificationNavigationRequest:{current:7},workspaceEntryNavigation:{current:{token:'owner',request:7}},setWorkspaceEntryToken:value=>navigation.entry=value,setProviderWorkspaceVisible:value=>navigation.provider=value};
 vm.runInNewContext(compile('const routeEntry = '+entryCallback+'; exports.routeEntry=routeEntry;'),{...navigation,exports:navigation});
 navigation.routeEntry(true);assert.equal(navigation.entry,'owner');assert.equal(navigation.provider,true,'actual App callback must open business tools after nonzero logout/reset counters');
 navigation.provider=false;navigation.routeEntry(false);assert.equal(navigation.provider,false);
 navigation.notificationNavigationRequest.current=8;navigation.routeEntry(true);assert.equal(navigation.provider,false,'a pending explicit notification destination must win over automatic entry');
 navigation.entry=null;navigation.sessionTokenRef.current='different-owner';navigation.routeEntry(true);assert.equal(navigation.entry,null,'logged-out account cannot route');
 const workspace=fs.readFileSync('components/ProviderWorkspace.tsx','utf8');const dispatch=workspace.slice(workspace.indexOf('export function ProviderWorkspace('),workspace.indexOf('export function NativeProviderAccount('));const renderModule={exports:{},React:react,process:{env:{}},LegacyProviderWorkspace:'Legacy',NativeProviderAccount:'Native'};vm.runInNewContext(compile(dispatch),renderModule);
 assert.equal(renderModule.exports.ProviderWorkspace({token:'owner'}).type,'Native','native must not disappear when an ordinary build omits an opt-in flag');renderModule.process.env.EXPO_PUBLIC_NATIVE_PROVIDER_ACCOUNT='false';assert.equal(renderModule.exports.ProviderWorkspace({token:'owner'}).type,'Legacy','explicit rollback remains available');
 const eas=JSON.parse(fs.readFileSync('eas.json'));assert.equal(eas.build.preview.env.EXPO_PUBLIC_NATIVE_PROVIDER_ACCOUNT,'true');assert.equal(eas.build.production.env.EXPO_PUBLIC_NATIVE_PROVIDER_ACCOUNT,'true');assert.notEqual(eas.build.production.env.EXPO_PUBLIC_DISTRIBUTION_CHANNEL,'direct','store build must not acquire direct external checkout');
 console.log('Provider entry passed: existing/restricted providers, customer404, error retry, explicit signup intent, no stale navigation, account-bound verification intent and ordinary build flags.');
})().catch(error=>{console.error(error);process.exitCode=1;});
