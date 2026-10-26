const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
let hooks=[],index=0,effects=[],changed=false,tree,alert,held,stored=null,failCheckout=false;
const calls=[],same=(a,b)=>a&&b&&a.length===b.length&&a.every((value,i)=>Object.is(value,b[i]));
const react = {
  createElement: (type, props, ...children) => ({type, props: props || {}, children: children.flat(Infinity)}),
  useRef: value => {const i = index++; return hooks[i] || (hooks[i] = {current: value});},
  useState: value => {const i = index++; if (!(i in hooks)) hooks[i] = typeof value === 'function' ? value() : value; return [hooks[i], next => {hooks[i] = typeof next === 'function' ? next(hooks[i]) : next; changed = true;}];},
  useEffect: (fn, deps) => {const i = index++; if (!hooks[i] || !same(hooks[i].deps, deps)) {const previous = hooks[i]; hooks[i] = {deps}; effects.push(() => {previous?.cleanup?.(); hooks[i].cleanup = fn();});}},
  useCallback: (fn, deps) => {const i = index++; if (!hooks[i] || !same(hooks[i].deps, deps)) hooks[i] = {deps, fn}; return hooks[i].fn;},
};

const compile=path=>ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText;
const policy={};vm.runInNewContext(compile('components/providerSubscriptionPolicy.ts'),{exports:policy,URL,Error});
const id='11111111-1111-4111-8111-111111111111',plan={id,name:'Basic',amount_ngn:500,period_prices:[{duration_months:12,amount_ngn:5400}]};
let renewal={can_manage:true,renewal_status:'stopped'},paymentState='pending',cancelState='cancelled',failCancel=false;
const provider={id,subscription:{status:'inactive'}},onChanged=async()=>{};
const request=async(token,path,options={})=>{
 calls.push({token,path,...options});
 if(path.endsWith('subscription-checkout')){if(held)await held;if(failCheckout)throw Error('Connection interrupted');return {tx_ref:'PROVIDER-'+id,checkout_link:'https://checkout.flutterwave.com/v3/hosted/pay/test'};}
 if(path.endsWith('subscription-checkout/cancel')){if(failCancel)throw Error('Cancellation status unavailable');return {payment_state:cancelState};}
 if(path.endsWith('subscription-confirm'))return {payment_state:paymentState};
 if(options.method==='POST'&&path.endsWith('subscription-renewal')){renewal={...renewal,renewal_status:'uncertain'};throw Error('Cancellation not confirmed');}
 return path.endsWith('subscription-plans')?{items:[plan]}:renewal;
};
const context={exports:{},Error,process:{env:{EXPO_PUBLIC_DISTRIBUTION_CHANNEL:'direct'}},require:name=>{
 if(name==='./ProviderTierDetails')return{ProviderTierDetails:'TierDetails',ProviderTierUsage:'TierUsage'};
 if(name==='./providerTierBenefits')return{tierExplanation:'Verified provider plan benefits'};
 if(name==='react')return react;
 if(name==='react-native')return {ActivityIndicator:'Spinner',Alert:{alert:(...args)=>alert=args},AppState:{addEventListener:()=>({remove(){}})},Platform:{OS:'android'},Pressable:'Button',View:'View'};
 if(name==='expo-secure-store')return {getItemAsync:async()=>stored,setItemAsync:async(key,value)=>{stored=value},deleteItemAsync:async()=>{stored=null}};
 if(name==='expo-web-browser')return {openAuthSessionAsync:async()=>({type:'cancel'})};
 if(name==='./ThemeProvider')return {ThemedText:'Text'};
 if(name==='./AccountDesign')return {useAccountDesign:()=>({})};
 if(name==='./nativeProviderApi')return {providerRequest:request};
 if(name==='./nativeProviderPolicy')return {hasPaidProviderAccess:p=>p.subscription?.status==='active'};
 if(name==='./utils')return {money:value=>'NGN '+value};
 if(name==='./providerSubscriptionPolicy')return policy;
 if(name==='./PlayProviderSubscription')return {PlayProviderSubscription:'PlaySubscription'};
 throw Error('Unexpected import '+name);
}};
vm.runInNewContext(compile('components/NativeProviderSubscription.tsx'),context);
function render(){index=0;effects=[];changed=false;tree=context.exports.DirectProviderSubscription({token:'synthetic-owner',provider,onChanged});effects.forEach(fn=>fn());}
async function settle(){for(let i=0;i<12;i++){await new Promise(resolve=>setImmediate(resolve));if(changed)render();}}
function nodes(node){return !node||typeof node!=='object'?[]:[node,...(node.children||[]).flatMap(nodes)];}
const text=node=>typeof node==='string'?node:node?.children?.map(text).join('')||'';
function button(label){const result=nodes(tree).find(node=>node.type==='Button'&&text(node)===label);assert.ok(result,'missing '+label);return result;}
const checkouts=()=>calls.filter(call=>call.path.endsWith('subscription-checkout'));
(async()=>{
 context.process.env.EXPO_PUBLIC_DISTRIBUTION_CHANNEL='play';
 let selected=context.exports.NativeProviderSubscription({token:'synthetic-owner',provider,onChanged});assert.ok(nodes(selected).some(node=>node.type==='PlaySubscription'),'Play builds must select native store billing');
 provider.subscription={status:'active',billing_provider:'flutterwave',billing_mode:'recurring'};
 selected=context.exports.NativeProviderSubscription({token:'synthetic-owner',provider,onChanged});assert.ok(nodes(selected).some(node=>node.props.managementOnly===true),'existing direct subscribers retain cancellation without external purchase routing');
 provider.subscription={status:'inactive'};context.process.env.EXPO_PUBLIC_DISTRIBUTION_CHANNEL='direct';
 render();await settle();button('Continue: NGN 500').props.onPress();assert.equal(checkouts().length,0);
 let release;held=new Promise(resolve=>release=resolve);failCheckout=true;
 const confirm=alert[2].find(item=>item.text==='Continue to payment').onPress;confirm();confirm();await settle();
 assert.equal(checkouts().length,1,'duplicate confirmation must make only one checkout');
 assert.equal(nodes(tree).filter(node=>node.type==='Button'&&node.props.accessibilityState?.busy).length,1,'only the chosen plan shows busy feedback');
 assert.equal(button('Refresh billing status').props.accessibilityState.busy,false);
 assert.equal(button('Refresh billing status').props.style({pressed:false}).opacity,1,'other controls stay visually unpressed while financial writes remain locked');
 assert.equal(JSON.parse(stored).provider_id,id,'persist uncertainty before sending checkout');
 assert.equal(checkouts()[0].token,'synthetic-owner');release();held=null;await settle();
 assert.ok(text(tree).includes('Connection interrupted'));assert.equal(button('Continue: NGN 500').props.disabled,true,'ambiguous checkout blocks a second payment');
 button('Check payment status').props.onPress();await settle();assert.ok(stored,'pending server result must retain recovery marker');
 paymentState='settled';button('Check payment status').props.onPress();await settle();assert.equal(stored,null);assert.ok(text(tree).includes('Payment verified'));

 failCheckout=false;paymentState='pending';
 button('Continue: NGN 500').props.onPress();alert[2].find(item=>item.text==='Continue to payment').onPress();await settle();
 assert.ok(stored,'closing the browser must not discard a possible payment');
 assert.equal(button('Continue: NGN 500').props.disabled,true);
 const cancels=()=>calls.filter(call=>call.path.endsWith('subscription-checkout/cancel'));
 button('Cancel unpaid checkout').props.onPress();assert.equal(cancels().length,0,'cancellation needs explicit unpaid confirmation');
 failCancel=true;alert[2].find(item=>item.text==='I have not paid').onPress();await settle();
 assert.ok(stored);assert.equal(button('Continue: NGN 500').props.disabled,true,'failed cancellation keeps payment protected');
 failCancel=false;cancelState='pending';button('Cancel unpaid checkout').props.onPress();alert[2].find(item=>item.text==='I have not paid').onPress();await settle();assert.ok(stored,'other pending payments keep the marker');
 cancelState='cancelled';button('Cancel unpaid checkout').props.onPress();const acceptCancel=alert[2].find(item=>item.text==='I have not paid').onPress;const beforeCancel=cancels().length;acceptCancel();acceptCancel();await settle();
 assert.equal(cancels().length,beforeCancel+1,'duplicate cancellation taps are serialized');
 assert.equal(stored,null);assert.equal(button('Continue: NGN 500').props.disabled,false,'verified cancellation unlocks plans');
 button('One-off bank transfer').props.onPress();await settle();button('Continue: NGN 500').props.onPress();alert[2].find(item=>item.text==='Continue to payment').onPress();await settle();
 assert.equal(JSON.parse(checkouts().at(-1).body).payment_method,'banktransfer','provider can retry with transfer');
 paymentState='settled';button('Check payment status').props.onPress();await settle();
 renewal={...renewal,has_pending_checkout:true};button('Refresh billing status').props.onPress();await settle();assert.ok(nodes(tree).some(node=>node.type==='Button'&&text(node)==='Cancel unpaid checkout'),'server pending checkout recovers without local marker');
 renewal={...renewal,has_pending_checkout:false};button('Check payment status').props.onPress();await settle();
 provider.subscription={status:'active',current_period_end:'2027-01-01T00:00:00Z'};renewal={...renewal,renewal_status:'active',current_plan_id:id};render();
 button('Stop automatic renewal').props.onPress();alert[2].find(item=>item.text==='Confirm').onPress();await settle();
 assert.ok(text(tree).includes('Cancellation not confirmed'));assert.equal(provider.subscription.status,'active','unconfirmed cancellation cannot revoke paid access');
 const count=checkouts().length;await settle();assert.equal(checkouts().length,count,'checkout is never automatically replayed');
 hooks.forEach(hook=>hook?.cleanup?.());console.log('Native subscription screen passed: confirmation, duplicate taps, durable interrupted checkout, authoritative recovery and uncertain cancellation.');
})().catch(error=>{console.error(error);process.exitCode=1;});
