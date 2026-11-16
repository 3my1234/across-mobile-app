const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText;
let state=[],index=0,dark=true,kind='products',busy=false,edited=[],archived=[],submitted=[],available=[];
const react={createElement:(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity)}),useState:initial=>{const i=index++;if(!(i in state))state[i]=initial;return[state[i],value=>state[i]=typeof value==='function'?value(state[i]):value];}};
const policyScope={exports:{}};vm.runInNewContext(compile(fs.readFileSync('components/providerPublishingPolicy.ts','utf8')),policyScope);
const stepsScope={exports:{},require:()=>policyScope.exports};vm.runInNewContext(compile(fs.readFileSync('components/providerListingSteps.ts','utf8')),stepsScope);
const steps=stepsScope.exports,policy=policyScope.exports,limits={post_limit:20,max_images:8,max_videos:1,max_video_seconds:180};
const scope={exports:{},require:name=>{
 if(name==='react')return react;
 if(name==='react-native')return{Modal:'Modal',Pressable:'Button',ScrollView:'Scroll',View:'View',Switch:'Switch',useWindowDimensions:()=>({width:360,height:740,fontScale:1.4})};
 if(name==='react-native-safe-area-context')return{useSafeAreaInsets:()=>({top:24,bottom:20})};
 if(name==='@expo/vector-icons')return{Ionicons:'Icon'};
 if(name==='./ThemeProvider')return{ThemedText:'Text',ThemedTextInput:'Input'};
 if(name==='./providerPublishingPolicy')return policy;
 if(name==='./AccountDesign')return{useAccountDesign:()=>({dark,text:dark?'#FFF':'#111',surface:dark?'#102D22':'#FFF',background:dark?'#08251B':'#FFF',line:'#345',muted:'#789',accent:'#18C998',danger:'#E35'})};
 if(name==='./ResilientImage')return{ResilientImage:'Photo'};
 if(name==='./ListingMediaGallery')return{ListingMediaGallery:'Gallery'};
 throw Error('Unexpected import '+name);
}};
vm.runInNewContext(compile(fs.readFileSync('components/ProviderPostGrid.tsx','utf8')),scope);
const item={id:'owned',title:'Earbuds',image_urls:['https://media.test/a','https://media.test/b'],media_urls:['https://media.test/service'],video_urls:['https://media.test/video'],attributes:{video_urls:['https://media.test/service-video']},moderation_status:'draft',status:'draft'};
const nodes=n=>!n||typeof n!=='object'?[]:[n,...(n.children||[]).flatMap(nodes)],text=n=>typeof n==='string'||typeof n==='number'?String(n):n?.children?.map(text).join('')||'';
function checkText(n,inside=false){if(n==null||typeof n==='boolean')return;if(typeof n==='string'||typeof n==='number'){assert.ok(inside,'Raw native text '+JSON.stringify(n));return;}for(const child of n.children||[])checkText(child,inside||n.type==='Text');}
function draw(items=[item]){index=0;const tree=scope.exports.ProviderPostGrid({items,kind,busy,onEdit:x=>edited.push(x),onArchive:x=>archived.push(x),onSubmit:x=>submitted.push(x),onAvailability:x=>available.push(x)});checkText(tree);return tree;}
function button(tree,label){const node=nodes(tree).find(n=>n.type==='Button'&&(n.props.accessibilityLabel===label||text(n)===label));assert.ok(node,'Missing '+label);return node;}
for(dark of [true,false])for(kind of ['products','listings']){
 state=[];let tree=draw();const image=nodes(tree).find(n=>n.type==='Photo');assert.equal(image.props.uri,kind==='products'?item.image_urls[0]:item.media_urls[0]);assert.equal(image.props.fallbackUri,'');assert.ok(nodes(tree).some(n=>n.props.style?.width==='47%'),'two-column layout');
 button(tree,'Actions for Earbuds').props.onPress();tree=draw();assert.ok(nodes(tree).some(n=>n.type==='Modal'));button(tree,kind==='products'?'Edit product':'Edit service').props.onPress();assert.equal(edited.at(-1).id,'owned');tree=draw();assert.ok(!nodes(tree).some(n=>n.type==='Modal'),'edit closes the sheet');
 button(tree,'Actions for Earbuds').props.onPress();tree=draw();button(tree,'View media').props.onPress();tree=draw();const gallery=nodes(tree).find(n=>n.type==='Gallery');assert.deepEqual(gallery.props.images,kind==='products'?item.image_urls:item.media_urls);assert.deepEqual(gallery.props.videos,kind==='products'?item.video_urls:item.attributes.video_urls);nodes(tree).find(n=>n.type==='Modal').props.onRequestClose();tree=draw();assert.ok(!nodes(tree).some(n=>n.type==='Modal'),'Android back closes media');
 button(tree,'Actions for Earbuds').props.onPress();tree=draw();button(tree,kind==='products'?'Archive product':'Archive service').props.onPress();assert.equal(archived.at(-1).id,'owned');tree=draw();
 button(tree,'Actions for Earbuds').props.onPress();tree=draw();button(tree,'Submit for review').props.onPress();assert.equal(submitted.at(-1).id,'owned');tree=draw();
 if(kind==='listings'){button(tree,'Actions for Earbuds').props.onPress();tree=draw();button(tree,'Add availability').props.onPress();assert.equal(available.at(-1).id,'owned');}
 state=[];tree=draw([{...item,status:'archived',moderation_status:'archived'}]);button(tree,'Actions for Earbuds').props.onPress();tree=draw([{...item,status:'archived',moderation_status:'archived'}]);assert.ok(!nodes(tree).some(n=>n.type==='Button'&&/^(Edit|Archive|Submit|Add availability)/.test(text(n))),'archived posts retain media without mutation actions');
 state=[];busy=true;tree=draw();assert.equal(button(tree,'Actions for Earbuds').props.disabled,true);busy=false;
}
const product={...policy.makeProductDraft({}),title:'Earbuds',description:'Clear sound',category_path:['Electronics'],local_selling_price:1500};
assert.equal(Object.keys(steps.listingStepErrors('products',product,limits,false,0)).length,0,'future location/photos do not block details');
assert.ok(steps.listingStepErrors('products',{...product,title:''},limits,false,0).title);
assert.ok(steps.listingStepErrors('products',product,limits,false,1).location);
assert.ok(steps.listingStepErrors('products',product,limits,false,2).images);
assert.equal(steps.listingStepForField('products','delivery_areas'),1);assert.equal(steps.listingStepForField('products','videos'),2);
const service={...policy.makeServiceDraft({}),title:'Painting',description:'Paint rooms',category:'Painting'};
assert.equal(Object.keys(steps.listingStepErrors('listings',service,limits,false,0)).length,0,'quote service does not require a fixed price');assert.ok(steps.listingStepErrors('listings',{...service,price:null,attributes:{price_mode:'fixed'}},limits,false,0).price);
// Optional delivery settings retain the same authoritative payload calculation.
const deliveryScope={exports:{},require:scope.require};vm.runInNewContext(compile(fs.readFileSync('components/NativeProviderDeliveryOffer.tsx','utf8')),deliveryScope);
state=[];let patched;
const delivery=()=>{index=0;const tree=deliveryScope.exports.NativeProviderDeliveryOffer({draft:product,busy:false,patch:(key,value)=>patched={key,value}});checkText(tree);return tree;};
let deliveryTree=delivery();assert.ok(!nodes(deliveryTree).some(n=>n.props.accessibilityLabel==='Delivery country (two-letter code)'),'country/currency codes start collapsed');
nodes(deliveryTree).find(n=>n.props.accessibilityLabel==='Delivery fee (NGN)').props.onChangeText('250');deliveryTree=delivery();button(deliveryTree,'Add delivery offer').props.onPress();assert.equal(patched.key,'delivery_areas');assert.equal(patched.value[0].delivered_price,1750);assert.equal(patched.value[0].uses_primary_price,true);
button(deliveryTree,'Change country, currency or item price').props.onPress();deliveryTree=delivery();assert.ok(nodes(deliveryTree).some(n=>n.props.accessibilityLabel==='Delivery country (two-letter code)'));assert.ok(nodes(deliveryTree).some(n=>n.type==='Switch'));
const optionsScope={exports:{},require:scope.require};vm.runInNewContext(compile(fs.readFileSync('components/NativeProviderProductOptions.tsx','utf8')),optionsScope);state=[];index=0;let options=optionsScope.exports.NativeProviderProductOptions({draft:product,busy:false,patch(){},section:'details'});checkText(options);assert.ok(!text(options).includes('Where is your stock?'));assert.ok(!nodes(options).some(n=>n.props.accessibilityLabel==='Crossed-out price (optional)'));button(options,'Add original price (optional)').props.onPress();index=0;options=optionsScope.exports.NativeProviderProductOptions({draft:product,busy:false,patch(){},section:'details'});assert.ok(nodes(options).some(n=>n.props.accessibilityLabel==='Crossed-out price (optional)'));
console.log('Provider post grid passed: two themes, product/service covers, status/action sheet, original media/video gallery, Android back, archived/busy guards and step validation.');
