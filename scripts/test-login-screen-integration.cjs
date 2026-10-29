// Execute the actual App handlers and AuthScreen function with synthetic ports.
// This is not a native renderer, live network test or physical-device claim.
const fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm'),assert=require('node:assert/strict');
const flush=()=>new Promise(r=>setImmediate(r));
function compile(source,extra={}){
 const context={exports:{},Date,Number,Math,Error,Promise,AbortController,performance,setTimeout,clearTimeout,...extra};
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.React},fileName:'test.tsx'}).outputText,context);return context;
}
const attempts=compile(fs.readFileSync('components/authAttempts.ts','utf8')).exports;
const retry=compile(fs.readFileSync('components/loginOverload.ts','utf8')).exports;
const app=ts.createSourceFile('App.tsx',fs.readFileSync('App.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function find(file,name){let found;function walk(node){if(ts.isFunctionDeclaration(node)&&node.name?.text===name)found=node;ts.forEachChild(node,walk);}walk(file);assert.ok(found,name);return found.getText(file);}
const names=['authenticate','cancelPasswordLogin','saveSession','readResponseBody','formatHttpError','authenticateWithGoogle','finishPrivyLogin'];
const handlers=names.map(name=>find(app,name)).join('\n')+'\nexports.handlers={'+names.join(',')+'};';
const future=()=>Math.floor(Date.now()/1000)+3600;
const response=(status,body={},headers={})=>({status,ok:status>=200&&status<300,headers:{get:name=>headers[name]??null},text:async()=>JSON.stringify(body)});
function fixture(fetch){
 const stores={},opened=[],alerts=[],notices=[],waits=[],requests=[];let releaseWrite,holdWrite=false,oauthCalls=0,now=0;
 const persistence=attempts.createSessionPersistence({
  token:async value=>{if(holdWrite){holdWrite=false;await new Promise(r=>releaseWrite=r);}stores.token=value;},
  expiry:async value=>{stores.expiry=value;},clear:async()=>{delete stores.token;delete stores.expiry;},open:s=>opened.push(s.access_token),
 });
 const clock={monotonic:()=>now,random:()=>.5,setTimer:(fn,ms)=>ms===30000?setTimeout(fn,100000):setTimeout(()=>{now+=ms;fn();},0),clearTimer:clearTimeout};
 const context=compile(handlers,{
  ...retry,loginWithOverloadRetry:(send,signal,notice)=>retry.loginWithOverloadRetry(send,signal,wait=>{waits.push(wait);notice(wait);},clock),
  authAttempts:{current:attempts.createAuthAttempts()},sessionPersistence:{current:persistence},passwordAttempt:{current:false},
  googleAttempt:{current:null},googleVerificationInFlight:{current:null},getPrivyAccessTokenWithRetry:async()=> 'synthetic-oauth',referralCode:'',privyLogout:async()=>{},setGoogleSessionClearing:()=>{},logoutInProgress:{current:false},busy:false,oauthBusy:false,googleSessionClearing:false,
  workspaceIntent:'customer',catalogCountry:'NG',API_URL:'https://synthetic.invalid',PRIVY_APP_ID:'synthetic',privyReady:true,privyUser:null,
  googleWorkspaceIntent:{current:'auto'},authMode:'signin',loginWithOAuth:async()=>{oauthCalls++;},
  setBusy:()=>{},setOauthBusy:()=>{},setWorkspaceIntent:()=>{},setAuthMode:()=>{},setLoginNotice:value=>notices.push(value),
  signupWorkspaceFor:async()=> 'provider',validateSignupReferral:async()=>{},rememberSignupWorkspace:async()=>{},
  Alert:{alert:(...args)=>alerts.push(args)},fetch:async(url,options)=>{requests.push({url,body:options.body});return fetch(requests.length,options.signal);},
 });
 return {context,handlers:context.exports.handlers,stores,opened,alerts,notices,waits,requests,hold:()=>holdWrite=true,release:()=>releaseWrite(),oauthCalls:()=>oauthCalls};
}
const credentials={email:'synthetic@example.invalid',password:'Synthetic!Pass1'};
async function screenChecks(){
 const file=ts.createSourceFile('Screens.tsx',fs.readFileSync('components/Screens.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const createElement=(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity)});
 const elements=Object.fromEntries(['ImageBackground','View','StatusBar','KeyboardFrame','ScrollView','Image','Text','Pressable','ActivityIndicator','Ionicons','TextInput'].map(n=>[n,n]));
 const context=compile(find(file,'AuthScreen'),{...elements,React:{createElement,Fragment:'Fragment'},useTheme:()=>({dark:false,color:x=>x}),useThemedStyles:()=>({}),sharedStyles:{},useSafeAreaInsets:()=>({top:0,bottom:0,left:0,right:0}),useState:value=>[value,()=>{}],useRef:value=>({current:value}),useEffect:()=>{},Platform:{OS:'android'},MOBILE_AUTH_BACKGROUND:1,LOGO:1,COLORS:{primary:'#00aa00'}});
 function flatten(node,result=[]){if(node&&typeof node==='object'){result.push(node);for(const child of node.children||[])flatten(child,result);}return result;}
 let cancelled=0;const nodes=flatten(context.exports.AuthScreen({mode:'signin',busy:true,googleBusy:false,loginNotice:'Sign-in is busy',onCancelLogin:()=>cancelled++,buyerMarkets:[]}));
 const cancel=nodes.find(n=>n.props.accessibilityLabel==='Cancel sign-in');assert.ok(cancel);cancel.props.onPress();assert.equal(cancelled,1);
 for(const placeholder of ['Email','Password'])assert.equal(nodes.find(n=>n.props.placeholder===placeholder).props.editable,false);
 assert.ok(nodes.some(n=>n.props.accessibilityLiveRegion==='polite'));
 const back=nodes.find(n=>n.type==='Pressable'&&n.children.some(c=>c?.type==='Text'&&c.children.includes('Back')));assert.equal(back.props.disabled,false,'Back remains usable to cancel password login');
 const googleNodes=flatten(context.exports.AuthScreen({mode:'signin',busy:true,googleBusy:true,loginNotice:'',buyerMarkets:[]}));
 const googleBack=googleNodes.find(n=>n.type==='Pressable'&&n.children.some(c=>c?.type==='Text'&&c.children.includes('Back')));assert.equal(googleBack.props.disabled,true);
 const loadingNodes=flatten(context.exports.AuthScreen({mode:'welcome',busy:false,googleBusy:false,googleReady:false,googleTimedOut:false,loginNotice:'',buyerMarkets:[]}));
 const preparing=loadingNodes.find(n=>n.props.accessibilityLabel==='Google sign-in is loading');assert.equal(preparing.props.disabled,true);assert.equal(preparing.props.accessibilityState.disabled,true,'initial SDK loading must not look like a failed sign-in attempt');
 const readyNodes=flatten(context.exports.AuthScreen({mode:'welcome',busy:false,googleBusy:false,googleReady:true,googleTimedOut:false,loginNotice:'',buyerMarkets:[]}));assert.equal(readyNodes.find(n=>n.props.accessibilityLabel==='Sign in with Google').props.disabled,false);
}
(async()=>{
 let complete;const rapid=fixture(()=>new Promise(r=>complete=r));const first=rapid.handlers.authenticate('/api/v1/auth/login',credentials);await flush();await rapid.handlers.authenticate('/api/v1/auth/login',credentials);await rapid.handlers.authenticate('/api/v1/auth/signup',credentials);await rapid.handlers.authenticateWithGoogle();assert.equal(rapid.requests.length,1);assert.equal(rapid.oauthCalls(),0);complete(response(200,{access_token:'one',expires_at:future()}));await first;assert.deepEqual(rapid.opened,['one']);
 const retrying=fixture(async n=>n===1?response(503,{}, {'Retry-After':'2'}):response(200,{access_token:'recovered',expires_at:future()}));const supplied={...credentials};const pending=retrying.handlers.authenticate('/api/v1/auth/login',supplied);supplied.password='changed';await pending;assert.equal(retrying.requests.length,2);assert.equal(retrying.requests[0].body,retrying.requests[1].body);assert.equal(JSON.parse(retrying.requests[0].body).password,credentials.password);assert.equal(retrying.waits[0].delayMs,2500);assert.ok(retrying.notices.some(n=>n.includes('busy')));assert.deepEqual(retrying.opened,['recovered']);
 for(const path of ['/api/v1/auth/signup','/api/v1/auth/login']){
  const noRetry=fixture(async()=>response(path.endsWith('signup')?503:401,{}, {'Retry-After':'2'}));await noRetry.handlers.authenticate(path,credentials);assert.equal(noRetry.requests.length,1);assert.equal(noRetry.waits.length,0);assert.deepEqual(noRetry.opened,[]);
 }
 const offline=fixture(async()=>{throw Error('Network request failed');});await offline.handlers.authenticate('/api/v1/auth/login',credentials);assert.equal(offline.requests.length,1);assert.equal(offline.context.authAttempts.current.pending,false);assert.deepEqual(offline.opened,[]);assert.ok(offline.alerts[0][1].includes('Network request failed'));
 let staleReply;const cancelled=fixture(n=>n===1?new Promise(r=>staleReply=r):Promise.resolve(response(200,{access_token:'new',expires_at:future()})));
 const obsolete=cancelled.handlers.authenticate('/api/v1/auth/login',credentials);await flush();cancelled.handlers.cancelPasswordLogin();await obsolete;
 await cancelled.handlers.authenticate('/api/v1/auth/login',credentials);staleReply(response(200,{access_token:'old',expires_at:future()}));await flush();assert.deepEqual(cancelled.opened,['new']);assert.equal(cancelled.stores.token,'new');
 const committing=fixture(async()=>response(200,{access_token:'cancelled-write',expires_at:future()}));committing.hold();const commit=committing.handlers.authenticate('/api/v1/auth/login',credentials);await flush();committing.handlers.cancelPasswordLogin();committing.release();await commit;assert.deepEqual(committing.opened,[]);assert.deepEqual(committing.stores,{});
 for(const event of ['background','unmount']) {
  const lifecycle=fixture(()=>new Promise(()=>{}));
  let effect;function visit(node){if(ts.isCallExpression(node)&&node.expression.getText(app)==='useEffect'&&node.arguments[0]?.getText(app).includes('const listener = AppState.addEventListener'))effect=node.arguments[0].getText(app);ts.forEachChild(node,visit);}visit(app);assert.ok(effect);
  let change;lifecycle.context.AppState={addEventListener:(_name,fn)=>{change=fn;return{remove(){}};}};
  vm.runInNewContext(ts.transpileModule('exports.mount='+effect,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText,lifecycle.context);
  const cleanup=lifecycle.context.exports.mount();const request=lifecycle.handlers.authenticate('/api/v1/auth/login',credentials);await flush();
  if(event==='background'){change('inactive');assert.equal(lifecycle.context.authAttempts.current.pending,true);change('background');}else cleanup();
  await request;assert.deepEqual(lifecycle.opened,[]);assert.deepEqual(lifecycle.stores,{});
 }
 let oldGoogleResponse;const staleGoogle=fixture(async()=>response(200,{access_token:'new-password-account',expires_at:future()}));
 staleGoogle.context.googleSessionRequest=()=>new Promise(resolve=>oldGoogleResponse=resolve);
 staleGoogle.context.googleAttempt.current=staleGoogle.context.authAttempts.current.begin();
 const oldGoogle=staleGoogle.handlers.finishPrivyLogin();await flush();staleGoogle.context.authAttempts.current.cancel();
 await staleGoogle.handlers.authenticate('/api/v1/auth/login',credentials);oldGoogleResponse({response:response(200),body:{access_token:'old-google-account',expires_at:future()}});await oldGoogle;
 assert.deepEqual(staleGoogle.opened,['new-password-account']);assert.equal(staleGoogle.stores.token,'new-password-account');
 const invalid=fixture(async()=>response(200,{access_token:'',expires_at:future()}));await invalid.handlers.authenticate('/api/v1/auth/login',credentials);assert.deepEqual(invalid.opened,[]);assert.deepEqual(invalid.stores,{});
 // An already completed Google login survives a temporary backend failure.
 const googleRetry=fixture(async()=>response(200));let exchanges=0,logouts=0,clearing=0;
 googleRetry.context.privyUser={id:'synthetic-identity'};
 googleRetry.context.privyLogout=async()=>{logouts++;};googleRetry.context.setGoogleSessionClearing=()=>{clearing++;};
 googleRetry.context.googleSessionRequest=async()=>{exchanges++;return exchanges===1?{response:response(503),body:{message:'Temporarily busy'}}:{response:response(200),body:{access_token:'google-recovered',expires_at:future()}};};
 await googleRetry.handlers.authenticateWithGoogle();assert.equal(exchanges,1);assert.equal(logouts,0);assert.equal(googleRetry.context.authAttempts.current.pending,false);assert.deepEqual(googleRetry.opened,[]);
 await googleRetry.handlers.authenticateWithGoogle();assert.equal(exchanges,2);assert.equal(googleRetry.oauthCalls(),0);assert.deepEqual(googleRetry.opened,['google-recovered']);assert.equal(logouts,0);
 for(const status of [401,403]){
  const rejected=fixture(async()=>response(200));let cleared=0;rejected.context.privyUser={id:'synthetic-identity'};rejected.context.setGoogleSessionClearing=()=>{cleared++;};rejected.context.privyLogout=async()=>{logouts++;};
  rejected.context.googleSessionRequest=async()=>({response:response(status),body:{message:'Rejected'}});
  await rejected.handlers.authenticateWithGoogle();assert.equal(cleared,1);assert.deepEqual(rejected.opened,[]);assert.equal(rejected.context.authAttempts.current.pending,false);
 }
 const sdkAhead=fixture(async()=>response(200));sdkAhead.context.privyUser=null;
 sdkAhead.context.loginWithOAuth=async()=>{throw Object.assign(Error('Already logged in'),{code:'attempted_login_with_oauth_while_already_logged_in'});};
 sdkAhead.context.googleSessionRequest=async()=>({response:response(200),body:{access_token:'sdk-session-ahead-of-render',expires_at:future()}});
 await sdkAhead.handlers.authenticateWithGoogle();assert.deepEqual(sdkAhead.opened,['sdk-session-ahead-of-render']);assert.equal(sdkAhead.alerts.length,0,'SDK session ahead of React render still completes signed-token verification');
 const browserCancelled=fixture(async()=>response(200));browserCancelled.context.loginWithOAuth=async()=>{throw Object.assign(Error('Cancelled'),{code:'login_with_oauth_was_cancelled_by_user'});};
 await browserCancelled.handlers.authenticateWithGoogle();assert.equal(browserCancelled.alerts.length,0);assert.equal(browserCancelled.context.authAttempts.current.pending,false);
 assert.ok(!fs.readFileSync('App.tsx','utf8').includes('if (oauthState.status === "error")'),'one attempt-owned OAuth error path, no duplicate unowned SDK-state alert');
 await screenChecks();
 console.log('Actual login handler/screen integration passed: rapid taps, competing signup/OAuth, stable credentials across503retry, signup/401single-shot behavior, stale replies, cancellation during storage, invalid sessions, accessible busy feedback and usable cancel/back controls.');
})().catch(e=>{console.error(e);process.exitCode=1;});
