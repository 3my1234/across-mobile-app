const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const source=fs.readFileSync(path.join(__dirname,'../components/MarketplaceScreen.tsx'),'utf8');
const start=source.indexOf('  const loadListings = useCallback('),end=source.indexOf('\n  async function refreshNearby',start);
async function main(){
 let feed={key:'',status:'loading'},items=[],resolve;
 const key='["","",false,null,null]';
 const g={listingQueryKey:key,listingQueryRef:{current:key},listingRequest:{current:0},nearby:null,type:'',search:'',highlyRated:false,onlineListingsLoaded:{current:false},API_URL:'https://example.test',URLSearchParams,Date,Error,useCallback:fn=>fn,
  setListingFeed:value=>{feed=value;},setItems:value=>{items=typeof value==='function'?value(items):value;},setSelected:()=>{},setListingCursor:()=>{},setCacheNotice:()=>{},setError:()=>{},setLoading:()=>{},setLoadingMore:()=>{},setRefreshing:()=>{},freshCatalogURL:x=>x,apiMessage:(body,fallback)=>body.message||fallback,readNearbySnapshot:async()=>null,fetchWithTimeout:()=>new Promise(r=>{resolve=r;})};
 const context=vm.createContext(g);vm.runInContext(ts.transpileModule(source.slice(start,end)+'\nglobalThis.load=loadListings;',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
 const pending=()=>feed.key!==g.listingQueryKey||feed.status==='loading';
 assert.ok(pending(),'the first paint before the debounce must show loading');
 const first=context.load();assert.ok(pending());resolve({ok:true,status:200,json:async()=>({items:[{id:'mechanic'}]})});await first;assert.equal(feed.status,'ready');assert.equal(items.length,1);
 const refresh=context.load(true);assert.equal(items.length,1,'retain successful rows while refreshing');resolve({ok:false,status:503,json:async()=>({})});await refresh;assert.equal(feed.status,'error');assert.equal(items.length,1);
 g.listingQueryKey='new-filter';g.listingQueryRef.current='new-filter';assert.ok(pending(),'a filter changes loading state before its request starts');
 const changed=context.load();g.listingQueryRef.current='newer-filter';resolve({ok:true,status:200,json:async()=>({items:[]})});await changed;assert.equal(items.length,1,'ignore stale filter responses');
 g.listingQueryRef.current=g.listingQueryKey;const empty=context.load();resolve({ok:true,status:200,json:async()=>({items:[]})});await empty;assert.equal(feed.status,'ready');assert.equal(items.length,0,'only a successful empty response can show no services');
 console.log('Service loading passed: first paint, debounce, refresh retention, error state, stale filters and confirmed empty results.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
