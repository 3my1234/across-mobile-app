/* global __dirname */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
function moduleOf(file,dependencies={}) {
 const context=vm.createContext({exports:{},require:name=>dependencies[name]||{},Map,Set,JSON,Date,Promise,AbortController,setTimeout,clearTimeout});
 vm.runInContext(ts.transpileModule(read(file),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
 return context.exports;
}
function run(code,globals){const context=vm.createContext(globals);vm.runInContext(ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);return context;}
async function main(){
 const helpers=moduleOf('components/cartGroups.ts');
 const product=(id,seller,route='merchant_local')=>({id,sku:id,title:id,provider_id:seller,fulfillment_mode:route,currency:'NGN',price:100,inventory_count:10});
 const a=product('a','seller-1'),b=product('b','seller-1'),c=product('c','seller-2'),d=product('d','seller-1','merchant_cross_border');
 let cart=[];const app=read('App.tsx');let quote=null,deletions=0;
 const state={quote,busy:false,activeTab:'home',setCart:fn=>{cart=fn(cart);},getCartQuantity:sku=>cart.find(i=>i.product.sku===sku)?.quantity||0,
  cartGroupKey:helpers.cartGroupKey,clearPendingPayment:()=>{deletions++;},Alert:{alert:()=>{throw new Error('Adding a mixed group must not ask to replace a cart');}}};
 const additions=run(app.slice(app.indexOf('  function addToCart('),app.indexOf('  async function checkout(')),state);
 additions.addToCart(a);additions.addToCart(b);additions.addToCart(c);additions.addToCart(d);additions.addToCart(a);
 const groups=helpers.groupCart(cart);assert.equal(groups.length,3);assert.equal(groups[0].items.length,2);assert.equal(cart[0].quantity,2);assert.equal(deletions,0);
 const storedCart=JSON.stringify(cart.map(item=>({product:item.product,sku:item.product.sku,quantity:item.quantity})));
 const savedQuote={order_id:'pending',country_code:'NG',cart_group_key:groups[0].key,cart_items:groups[0].items.map(item=>({product_id:item.product.id,quantity:item.quantity}))};
 let restored=[],restoredQuote=null;
 const hydrationState={cartHydrated:{current:false},sessionTokenRef:{current:'buyer'},catalogCountry:'NG',catalogState:'',catalogCity:'',catalogRequestKeyRef:{current:'NG||'},
  AsyncStorage:{getItem:async()=>storedCart,removeItem:async()=>{}},SecureStore:{getItemAsync:async()=>JSON.stringify({quote:savedQuote}),deleteItemAsync:async()=>{}},CART_KEY:'cart',PENDING_PAYMENT_KEY:'pending',
  cartRef:{current:[]},setCart:items=>{restored=items;},setQuote:value=>{restoredQuote=value;},cartGroupKey:helpers.cartGroupKey,cartFingerprint:()=>'',restoredPendingPayment:{current:false},setCartStorageReady:()=>{}};
 const hydration=run(app.slice(app.indexOf('  async function hydrateCart('),app.indexOf('  async function loadProducts(')),hydrationState);
 await hydration.hydrateCart([a]);assert.equal(restored.length,4,'restart must retain imported/off-feed cart items');assert.equal(restoredQuote.order_id,'pending');assert.equal(hydrationState.restoredPendingPayment.current,true);
 // Exercise actual checkout, not just grouping: the posted items must contain
 // only the chosen seller/route while all other groups remain saved.
 const calls=[];
 const checkoutState={token:'buyer',cart,checkoutItems:groups[0].items,profile:{full_name:'Buyer',email:'buyer@example.test',phone:'123',address:'Street',city:'Abuja',state:'FCT'},
  buyerMarkets:[{country_code:'NG',currency_code:'NGN'}],catalogCountry:'NG',quote:null,useXP:false,detectedCountryCode:null,API_URL:'https://example.test',checkoutInFlight:{current:false},sessionTokenRef:{current:'buyer'},
  setBusy:()=>{},setQuote:q=>{quote=q;},loadXPBalance:async()=>{},SecureStore:{setItemAsync:async(_,text)=>calls.push(JSON.parse(text))},PENDING_PAYMENT_KEY:'pending',
  fetchWithTimeout:async(_,init)=>{calls.push(JSON.parse(init.body));return{ok:true,status:200,json:async()=>({order_id:'paid',currency:'NGN',country_code:'NG',grand_total:303})};},
  fetchJSONWithTimeout:async(url,init)=>{const response=await checkoutState.fetchWithTimeout(url,init);return{response,body:await response.json()};},
  cartGroupKey:helpers.cartGroupKey,cartFingerprint:items=>items.map(i=>i.product.sku+':'+i.quantity).join('|'),money:String,Alert:{alert:()=>{}}};
 const checkout=run(app.slice(app.indexOf('  async function checkout('),app.indexOf('  async function payWithFlutterwave(')),checkoutState);
 await Promise.all([checkout.checkout(),checkout.checkout()]);assert.equal(calls.length,2,'two rapid taps must create only one quote and one saved recovery record');assert.equal(calls[0].items.length,2);assert.equal(calls[0].items[0].quantity,2);assert.equal(quote.cart_items.length,2);assert.equal(cart.length,4);
 const paymentState={token:'buyer',sessionTokenRef:{current:'buyer'},quote,quoteRef:{current:quote},completedPayments:{current:new Set()},cartRef:{current:cart},
  setCart:fn=>{cart=fn(cart);},removePurchasedItems:helpers.removePurchasedItems,stopPaymentPolling:()=>{},paymentConfirmationIssue:{current:''},setPaymentState:()=>{},setPaymentMessage:()=>{},setQuote:()=>{},
  SecureStore:{deleteItemAsync:async()=>{deletions++;}},PENDING_PAYMENT_KEY:'pending',loadNotifications:async()=>{},loadXPBalance:async()=>{},loadOrders:async()=>{},Alert:{alert:()=>{}},setActiveTab:()=>{}};
 const payment=run(app.slice(app.indexOf('  async function completeSuccessfulPayment('),app.indexOf('  function stopPaymentPolling(')),paymentState);
 await payment.completeSuccessfulPayment(quote);assert.equal(cart.length,2);assert.equal(cart[0].product.id,'c');assert.equal(cart[1].product.id,'d');
 await payment.completeSuccessfulPayment(quote);assert.equal(deletions,1,'duplicate confirmations must not remove goods twice');
 const reviewCalls=[];let scenario='lost';const draft={rating:4,review_text:'  Updated  ',media_urls:['photo']};
 const reviews=moduleOf('components/productReview.ts',{'./config':{API_URL:'https://example.test'},'./utils':{fetchJSONWithTimeout:async(url,init)=>{
  reviewCalls.push({url,init});if(init.method==='PUT'){
   if(scenario==='lost')throw new Error('Response lost after save');
   if(scenario==='denied')return{response:{ok:false,status:403},body:{message:'Delivery required'}};
   throw new Error('Network error');
  }
  return{response:{ok:true},body:{review:{id:'mine',rating:4,review_text:scenario==='unknown'?'Earlier text':'Updated',media_urls:['photo']}}};
 }}});
 const recovered=await reviews.saveProductReview('watch','buyer',draft);assert.equal(recovered.recovered,true);assert.equal(reviewCalls.filter(c=>c.init.method==='PUT').length,1);assert.equal(recovered.review_reward_claimed,undefined);
 scenario='denied';const count=reviewCalls.length;await assert.rejects(()=>reviews.saveProductReview('watch','buyer',draft),/Delivery required/);assert.equal(reviewCalls.length-count,1);
 scenario='unknown';await assert.rejects(()=>reviews.saveProductReview('watch','buyer',draft),/may have been saved/);
 // Header success with a body that never arrives must still hit the deadline.
 const utilsContext=vm.createContext({exports:{},require:()=>({}),process:{env:{}},AbortController,setTimeout,clearTimeout,Promise,fetch:async()=>({json:()=>new Promise(()=>{})})});
 vm.runInContext(ts.transpileModule(read('components/utils.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,utilsContext);
 await assert.rejects(()=>utilsContext.exports.fetchJSONWithTimeout('https://example.test',{},20),/too long/);
 console.log('Mixed-cart additions, grouped checkout, payment isolation/idempotence and review lost-response/body-deadline regressions passed.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
