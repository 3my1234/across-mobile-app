const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
let now=100000,requests=0,held,fail=false,uuid=0;
const scope={exports:{},URLSearchParams,Map,Set,Date:{now:()=>now},setTimeout,clearTimeout,require:name=>name==='expo-crypto'?{randomUUID:()=>String(++uuid)}:name==='./config'?{API_URL:'https://api.test'}:{mapProduct:p=>p,fetchJSONWithTimeout:async()=>{requests++;const id=requests;if(held)await held;if(fail)throw Error('offline');return{response:{ok:true},body:{similar:[],recommended:[],promoted:[{kind:'product',id:String(id),image_urls:['https://images.test/'+id],receipt:'receipt-'+id}]}};}}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/discoveryClient.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,scope);
const api=scope.exports,product={owner:'owner',country:'NG',kind:'product'},service={...product,kind:'service'};
(async()=>{
 const first=await api.discoveryFeed(product);assert.equal(requests,1);
 assert.equal(api.cachedDiscoveryFeed(product),first,'tab can paint saved cards immediately');
 assert.equal(await api.discoveryFeed(product),first);assert.equal(requests,1,'tab switches reuse fresh response');
 await api.discoveryFeed(service);assert.equal(requests,2,'product/service feeds are separate');
 await api.discoveryFeed({...product,city:'Abuja'});assert.equal(requests,3,'location is part of cache identity');
 await api.discoveryFeed({...product,search:'phones'});assert.equal(requests,4,'search is part of cache identity');
 let release;now+=61000;held=new Promise(resolve=>release=resolve);
 const one=api.discoveryFeed(product),two=api.discoveryFeed(product);assert.equal(requests,5,'stale response refresh coalesces');assert.equal(api.cachedDiscoveryFeed(product),first,'retain cards while refreshing');release();await Promise.all([one,two]);held=null;
 const second=api.cachedDiscoveryFeed(product);assert.notEqual(second,first);
 await api.discoveryFeed(product,true);assert.equal(requests,6,'catalogue revision forces fresh content');
 const saved=api.cachedDiscoveryFeed(product);now+=61000;fail=true;await assert.rejects(api.discoveryFeed(product));assert.equal(api.cachedDiscoveryFeed(product),saved,'temporary failure does not discard content');fail=false;
 held=new Promise(resolve=>release=resolve);const previousOwner=api.discoveryFeed(product,true);api.discoverySession('new-owner');assert.equal(api.cachedDiscoveryFeed({...product,owner:'new-owner'}),null,'accounts cannot inherit promotions');release();await previousOwner;held=null;assert.equal(api.cachedDiscoveryFeed({...product,owner:'new-owner'}),null,'late old response cannot seed new cache');
 for(let i=0;i<25;i++)await api.discoveryFeed({...product,owner:'new-owner',city:String(i)});
 assert.equal(api.cachedDiscoveryFeed({...product,owner:'new-owner',city:'0'}),null,'cache is bounded');
 now+=5*60000;assert.equal(api.cachedDiscoveryFeed({...product,owner:'new-owner',city:'24'}),null,'old cards expire');

 // Render the real section through tab lifecycle changes, not only the client.
 const uiContext={...product,owner:'ui-owner'};await api.discoveryFeed(uiContext);const beforeTabs=requests;
 let hooks=[],index=0,effects=[],changed=false,active=true,tree,delay;
 const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
 const react={createElement:(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity)}),useRef:v=>{const i=index++;return hooks[i]||(hooks[i]={current:v})},useState:v=>{const i=index++;if(!(i in hooks))hooks[i]=v;return[hooks[i],next=>{next=typeof next==='function'?next(hooks[i]):next;if(!Object.is(next,hooks[i])){hooks[i]=next;changed=true}}]},useEffect:(fn,deps)=>{const i=index++;if(!hooks[i]||!same(hooks[i].deps,deps)){const old=hooks[i];hooks[i]={deps};effects.push(()=>{old?.cleanup?.();hooks[i].cleanup=fn()})}}};
 const ui={exports:{},Map,Set,JSON,Date,Number,Math,setTimeout:fn=>{delay=fn;return fn},clearTimeout(){},setInterval:()=>0,clearInterval(){},require:name=>name==='react'?react:name==='react-native'?{View:'View',Pressable:'Button',ActivityIndicator:'Loading',AppState:{currentState:'active',addEventListener:()=>({remove(){}})}}:name==='./discoveryClient'?api:name==='./catalogFreshness'?{useCatalogFreshness(){}}:name==='./ThemeProvider'?{ThemedText:'Text'}:name==='./AccountDesign'?{useAccountDesign:()=>({})}:{ResilientImage:'Image'}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/DiscoverySections.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText,ui);
 const draw=()=>{for(let n=0;n<8;n++){index=0;effects=[];changed=false;tree=ui.exports.DiscoverySections({...uiContext,active,onOpen(){}});effects.forEach(fn=>fn());if(!changed)return}throw Error('render loop')};
 const nodes=n=>!n||typeof n!=='object'?[]:[n,...n.children.flatMap(nodes)];
 draw();assert.ok(!nodes(tree).some(n=>n.type==='Loading'),'cached section paints without loading placeholder');
 active=false;draw();assert.equal(tree,null);active=true;draw();delay();await new Promise(r=>setImmediate(r));draw();
 assert.equal(requests,beforeTabs,'returning to tab does not request fresh ads');assert.ok(!nodes(tree).some(n=>n.type==='Loading'));
 hooks.forEach(h=>h?.cleanup?.());
 console.log('Discovery cache passed: tab retention, context isolation, single-flight refresh, catalogue invalidation, offline continuity, stale account rejection and bounds.');
})().catch(error=>{console.error(error);process.exitCode=1});
