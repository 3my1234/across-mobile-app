const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const policy={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/playSubscriptionPolicy.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports:policy,Map,Set,Date,BigInt,Error,Promise});
const plan={product_id:'atl_basic',base_plan_id:'monthly',plan_id:'11111111-1111-4111-8111-111111111111',name:'Basic',duration_months:1,amount_minor:50000};
const catalog={account_id:'a'.repeat(64),items:[plan],status:'',state:'',auto_renews:false,needs_acknowledgement:false};
const product={platform:'android',id:'atl_basic',subscriptionOfferDetailsAndroid:[{basePlanId:'monthly',offerId:null,offerToken:'store-offer',pricingPhases:{pricingPhaseList:[{priceAmountMicros:'500000000',priceCurrencyCode:'NGN',billingPeriod:'P1M',recurrenceMode:1,formattedPrice:'₦500.00'}]}}]};
const purchase={store:'google',platform:'android',productId:'atl_basic',currentPlanId:'monthly',purchaseToken:'sensitive-purchase-token',obfuscatedAccountIdAndroid:'a'.repeat(64),purchaseState:'purchased'};
(async()=>{
 assert.equal(policy.playCatalog(catalog).items.length,1);assert.throws(()=>policy.playCatalog({...catalog,items:[plan,plan]}));
 assert.equal(policy.playOffer(plan,[product]).displayPrice,'₦500.00');
 for(const replacement of [{priceAmountMicros:'499000000'},{priceAmountMicros:'invalid'},{priceCurrencyCode:'USD'},{billingPeriod:'P1Y'},{recurrenceMode:2}]){const copy=JSON.parse(JSON.stringify(product));Object.assign(copy.subscriptionOfferDetailsAndroid[0].pricingPhases.pricingPhaseList[0],replacement);assert.equal(policy.playOffer(plan,[copy]),null);}
 const trial=JSON.parse(JSON.stringify(product));trial.subscriptionOfferDetailsAndroid[0].offerId='trial';assert.equal(policy.playOffer(plan,[trial]),null);
 for(const months of [3,6,12]){const prepaid=JSON.parse(JSON.stringify(product));const phase=prepaid.subscriptionOfferDetailsAndroid[0].pricingPhases.pricingPhaseList[0];phase.billingPeriod=`P${months}M`;phase.recurrenceMode=3;assert.ok(policy.playOffer({...plan,duration_months:months,prepaid:true},[prepaid]),'prepaid period must use one-off store offer');assert.equal(policy.playOffer({...plan,duration_months:months},[prepaid]),null);}
 assert.throws(()=>policy.playPurchasePayload({...purchase,obfuscatedAccountIdAndroid:'b'.repeat(64)},catalog));
 assert.throws(()=>policy.playPurchasePayload({...purchase,currentPlanId:undefined},{...catalog,items:[plan,{...plan,base_plan_id:'yearly'}]}));
 let verifies=0,finishes=0,changed=0,release;
 let outcome={active:true,pending:false,needs_acknowledgement:false,expires_at:new Date(Date.now()+86400000).toISOString()};
 const held=new Promise(resolve=>release=resolve);
 const process=policy.createPlayPurchaseProcessor(async body=>{verifies++;assert.equal(body.purchase_token,purchase.purchaseToken);await held;return outcome;},async()=>finishes++,async()=>changed++);
 const first=process(purchase,catalog),second=process(purchase,catalog);assert.equal(first,second,'duplicate store callbacks must share one verification');assert.equal(verifies,1);release();await first;assert.equal(finishes,1);assert.equal(changed,1);
 outcome={...outcome,pending:true,active:false};await process(purchase,catalog);assert.equal(finishes,1,'pending payments must not be acknowledged');assert.equal(changed,1);
 outcome={...outcome,pending:false,active:true,needs_acknowledgement:true};await process(purchase,catalog);assert.equal(finishes,1,'client cannot bypass uncertain server acknowledgement');assert.equal(changed,2);
 const failing=policy.createPlayPurchaseProcessor(async()=>{verifies++;throw Error('network');},async()=>finishes++,async()=>changed++);const before=verifies;await assert.rejects(()=>failing(purchase,catalog));assert.equal(verifies,before+1,'uncertain payment is not automatically replayed');assert.equal(finishes,1);
 outcome={...outcome,needs_acknowledgement:false,expires_at:'invalid'};await assert.rejects(()=>process(purchase,catalog));assert.equal(finishes,1);
 outcome={...outcome,refund_state:'requested',active:false};assert.match(await process(purchase,catalog),/confirmation is still pending/);assert.equal(finishes,1,'unfulfilled duplicate must not be acknowledged');
 outcome={...outcome,refund_state:undefined,active:'yes'};await assert.rejects(()=>process(purchase,catalog));assert.equal(finishes,1,'malformed activity must not finish a purchase');
 console.log('Play subscription: exact store prices, ownership, duplicate callbacks, pending/uncertain recovery and server-authoritative acknowledgement PASS.');
})().catch(error=>{console.error(error);process.exitCode=1;});
