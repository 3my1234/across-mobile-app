const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const compile=path=>ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText;
const policy={};vm.runInNewContext(compile('components/playSubscriptionPolicy.ts'),{exports:policy,Map,Set,Date,BigInt,Promise,Error});
let hooks=[],index=0,effects=[],dirty=false,tree,options,alert,changed=0,finished=0,held,resolveHeld;
const timers=new Map();let nextTimer=0;
const calls=[],same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
const react={createElement:(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity)}),useRef:v=>{const i=index++;return hooks[i]||(hooks[i]={current:v});},useState:v=>{const i=index++;if(!(i in hooks))hooks[i]=v;return[hooks[i],next=>{const value=typeof next==='function'?next(hooks[i]):next;if(!Object.is(value,hooks[i])){hooks[i]=value;dirty=true;}}];},useEffect:(fn,deps)=>{const i=index++;if(!hooks[i]||!same(hooks[i].deps,deps)){const old=hooks[i];hooks[i]={deps};effects.push(()=>{old?.cleanup?.();hooks[i].cleanup=fn();});}},useCallback:(fn,deps)=>{const i=index++;if(!hooks[i]||!same(hooks[i].deps,deps))hooks[i]={deps,fn};return hooks[i].fn;}};
const catalog={account_id:'a'.repeat(64),items:[{product_id:'atl_basic',base_plan_id:'monthly',plan_id:'11111111-1111-4111-8111-111111111111',name:'Basic',duration_months:1,amount_minor:50000}],status:'',state:'',auto_renews:false,needs_acknowledgement:false};
const product={platform:'android',id:'atl_basic',subscriptionOfferDetailsAndroid:[{basePlanId:'monthly',offerToken:'safe-offer',pricingPhases:{pricingPhaseList:[{priceAmountMicros:'500000000',priceCurrencyCode:'NGN',billingPeriod:'P1M',recurrenceMode:1,formattedPrice:'₦500.00'}]}}]};
const iap={connected:true,subscriptions:[product],availablePurchases:[],fetchProducts:async()=>{},getAvailablePurchases:async()=>{},finishTransaction:async()=>finished++,requestPurchase:async request=>{calls.push({path:'native-checkout',request});}};
let result={active:true,pending:false,needs_acknowledgement:false,expires_at:new Date(Date.now()+86400000).toISOString()};
const request=async(token,path,config={})=>{calls.push({path,token,...config});if(path.endsWith('/prepare'))return{account_id:catalog.account_id};if(path.endsWith('/verify')){if(held)await held;return result;}return catalog;};
const context={exports:{},Set,Date,Promise,Error,setTimeout:fn=>{const id=++nextTimer;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id),require:name=>{
 if(name==='react')return react;
 if(name==='react-native')return{ActivityIndicator:'Spinner',Alert:{alert:(...args)=>alert=args},AppState:{addEventListener:()=>({remove(){}})},Linking:{openURL:async()=>{}},Pressable:'Button',View:'View'};
 if(name==='expo-iap')return{useIAP:value=>{options=value;return iap;}};
 if(name==='./ThemeProvider')return{ThemedText:'Text'};
 if(name==='./AccountDesign')return{useAccountDesign:()=>({})};
 if(name==='./nativeProviderApi')return{providerRequest:request};
 if(name==='./nativeProviderPolicy')return{hasPaidProviderAccess:()=>false};
 if(name==='./playSubscriptionPolicy')return policy;
 throw Error('Unexpected import '+name);
}};
vm.runInNewContext(compile('components/PlayProviderSubscription.tsx'),context);
const props={token:'synthetic-owner',provider:{id:'provider-a',subscription:{status:'none'}},onChanged:async()=>changed++};
function render(){index=0;effects=[];dirty=false;tree=context.exports.PlayProviderSubscription(props);effects.forEach(fn=>fn());}
async function settle(){for(let i=0;i<20;i++){await new Promise(resolve=>setImmediate(resolve));if(dirty)render();}}
const nodes=n=>!n||typeof n!=='object'?[]:[n,...(n.children||[]).flatMap(nodes)];
const text=n=>typeof n==='string'?n:n?.children?.map(text).join('')||'';
const button=label=>{const found=nodes(tree).find(n=>n.type==='Button'&&text(n)===label);assert.ok(found,'Missing '+label);return found;};
(async()=>{
 render();await settle();assert.ok(text(tree).includes('₦500.00 / month'));button('Subscribe with Google Play').props.onPress();
 assert.equal(calls.filter(c=>c.path==='native-checkout').length,0,'show confirmation before opening billing');
 const confirm=alert[2].find(a=>a.text==='Continue with Google Play').onPress;confirm();confirm();await settle();
 assert.equal(calls.filter(c=>c.path.endsWith('/prepare')).length,1);assert.equal(calls.filter(c=>c.path==='native-checkout').length,1);
 const native=calls.find(c=>c.path==='native-checkout').request;assert.equal(native.request.google.obfuscatedAccountIdAndroid,catalog.account_id);assert.equal(native.request.google.subscriptionOffers[0].offerToken,'safe-offer');
 assert.equal(changed,0,'native checkout resolution cannot grant access');assert.equal(finished,0);
 for(const fn of [...timers.values()])fn();await settle();assert.ok(text(tree).includes('taking longer than expected'));assert.equal(calls.filter(c=>c.path==='native-checkout').length,1,'timeout must not replay checkout');
 const purchase={platform:'android',store:'google',productId:'atl_basic',currentPlanId:'monthly',purchaseToken:'sensitive-purchase-token',purchaseState:'purchased'};
 held=new Promise(resolve=>resolveHeld=resolve);options.onPurchaseSuccess(purchase);options.onPurchaseSuccess(purchase);await settle();assert.equal(calls.filter(c=>c.path.endsWith('/verify')).length,1);assert.ok(nodes(tree).some(node=>node.props.accessibilityLabel==='Checking Google Play payment'),'verification must not look frozen');resolveHeld();held=null;await settle();assert.equal(changed,1);assert.equal(finished,1);assert.ok(text(tree).includes('payment verified'));
 result={...result,pending:true,active:false};options.onPurchaseSuccess(purchase);await settle();assert.equal(finished,1);assert.ok(text(tree).includes('Payment is pending'));
 hooks.forEach(h=>h?.cleanup?.());options.onPurchaseSuccess(purchase);await settle();assert.equal(finished,1,'unmounted screen cannot finish a later purchase');
 console.log('Actual Play screen: store price, consent, single checkout reservation, event-only verification, duplicate callbacks, pending payment and unmount safety PASS.');
})().catch(error=>{console.error(error);process.exitCode=1;});
