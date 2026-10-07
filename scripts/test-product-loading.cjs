/* global __dirname */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const source=fs.readFileSync(path.join(__dirname,'../App.tsx'),'utf8');
const code=source.slice(source.indexOf('  async function loadProducts('),source.indexOf('\n\tasync function loadFlashSales'));
async function main(){
 let feed={key:'',status:'loading'},products=[],resolve,failed=false;
 const globals={catalogCountry:'NG',catalogState:'',catalogCity:'',catalogRequestKeyRef:{current:'NG||'},productLoadInFlight:{current:null},productReloadQueued:{current:null},productLoadContext:{current:{}},productSnapshots:{current:new Map()},buyerCoordinatesRef:{current:null},cartRef:{current:[]},selectedProductRef:{current:null},flashSaleContext:{current:{visible:false}},PRODUCT_REQUEST_TIMEOUT:1000,API_URL:'https://example.test',URLSearchParams,AbortController,Map,Date,
  setTimeout:()=>1,clearTimeout:()=>{},sleep:async()=>{},fetch:()=>failed?Promise.resolve({ok:false,status:503}):new Promise(r=>{resolve=r;}),setProductFeed:update=>{feed=typeof update==='function'?update(feed):update;},setProducts:update=>{products=update;},mapProduct:x=>x,latestProductSnapshot:(_,x)=>x,hydrateCart:async()=>{},applyProductSnapshots:()=>{},loadFlashSales:async()=>{},Image:{prefetch:async()=>true}};
 const context=vm.createContext(globals);vm.runInContext(ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
 const first=context.loadProducts();assert.equal(feed.status,'loading');assert.equal(products.length,0);resolve({ok:true,json:async()=>({products:[{id:'watch'}]})});await first;assert.equal(feed.status,'ready');assert.equal(products[0].id,'watch');
 const refresh=context.loadProducts(true);assert.equal(feed.status,'ready','refresh must retain existing confirmed data');resolve({ok:true,json:async()=>({products:[]})});await refresh;assert.equal(feed.status,'ready');assert.equal(products.length,0,'an actual empty response may show the empty state');
 feed={key:'',status:'loading'};failed=true;await context.loadProducts();assert.equal(feed.status,'error','failed initial requests must not claim no products are available');
 failed=false;const stale=context.loadProducts();globals.catalogRequestKeyRef.current='US||';resolve({ok:true,json:async()=>({products:[{id:'wrong-market'}]})});await stale;assert.equal(products.length,0,'old destination responses must not replace the current feed');
 console.log('Home loading passed: first-load state, refresh retention, confirmed empty results, network errors and stale destinations.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
