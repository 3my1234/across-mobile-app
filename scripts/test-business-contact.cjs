const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React}}).outputText;
async function main(){
 let cells=[],index=0,previous=[],cleanups=[],effects=[],requests=[];
 const React={useState:initial=>{const i=index++;if(!(i in cells))cells[i]=initial;return [cells[i],value=>{cells[i]=typeof value==='function'?value(cells[i]):value;}];},useRef:initial=>{const i=index++;return cells[i]||(cells[i]={current:initial});},useEffect:(fn,deps)=>{const i=index++;if(!previous[i]||deps.some((x,j)=>x!==previous[i][j])){cleanups[i]?.();previous[i]=deps;effects.push(()=>{cleanups[i]=fn();});}}};
 const context={exports:{},encodeURIComponent,require:name=>name==='react'?React:{providerRequest:(token,path)=>new Promise((resolve,reject)=>requests.push({token,path,resolve,reject}))}};
 vm.runInNewContext(compile(fs.readFileSync('components/useBusinessContact.ts','utf8')),context);
 const render=(token,id)=>{index=0;const out=context.exports.useBusinessContact(token,id);effects.splice(0).forEach(fn=>fn());return out;};
 const settle=()=>new Promise(resolve=>setImmediate(resolve));
 assert.equal(render(null,'business').checking,false);assert.equal(requests.length,0);
 assert.equal(render('owner','business').checking,true);assert.equal(requests[0].token,'owner');
 requests[0].resolve({own_business:true,can_manage:true});await settle();let access=render('owner','business');assert.equal(access.own,true);assert.equal(access.canManage,true);
 access=render('customer','business');assert.equal(access.own,false);assert.equal(access.checking,true,'old provider state cannot leak across account switch');requests[1].resolve({own_business:false,can_manage:false});await settle();assert.equal(render('customer','business').own,false);
 render('staff','business');render('new-customer','business');requests[2].resolve({own_business:true,can_manage:false});await settle();assert.equal(render('new-customer','business').checking,true,'stale membership response is ignored');requests[3].resolve({own_business:false,can_manage:false});await settle();assert.equal(render('new-customer','business').own,false);
 render('staff','business');requests[4].resolve({own_business:true,can_manage:false});await settle();access=render('staff','business');assert.equal(access.own,true);assert.equal(access.canManage,false);
 render('staff','other-business');requests[5].reject(Error('offline'));await settle();access=render('staff','other-business');assert.match(access.error,/retry/i);assert.equal(access.own,false);access.retry();access=render('staff','other-business');assert.equal(access.checking,true);requests[6].resolve({own_business:false,can_manage:false});await settle();assert.equal(render('staff','other-business').error,'');
 // Exercise the actual product action for owners, staff and ordinary customers.
 const source=fs.readFileSync('components/Screens.tsx','utf8'),start=source.indexOf('  const contactSeller=()'),end=source.indexOf('  useEffect(',start);let managed=null,contacts=0,opened=0;
 const state={contactAccess:{checking:false,error:'',own:true,canManage:true},onManageListing:(kind,id)=>{managed={kind,id};},initialProduct:{id:'product'},token:'owner',recordDiscoveryContact:()=>contacts++,setSellerChat:()=>opened++,Alert:{alert:()=>{throw Error('unexpected alert');}}};
 vm.runInNewContext(compile(source.slice(start,end)+';globalThis.contactSeller=contactSeller;'),state);state.contactSeller();assert.equal(managed.id,'product');assert.equal(opened,0);assert.equal(contacts,0);
 state.contactAccess.canManage=false;managed=null;state.contactSeller();assert.equal(managed,null);assert.equal(opened,0);
 state.contactAccess.own=false;state.contactSeller();assert.equal(opened,1);assert.equal(contacts,1);
 // Manage opens the exact private editor, including products beyond page one.
 const catalog=fs.readFileSync('components/NativeProviderCatalog.tsx','utf8'),from=catalog.indexOf('  const initialEdit='),to=catalog.indexOf('  const images =',from);
 for(const kind of ['products','listings']){
  let draft=null,last,path='';const ref={current:false},snapshot={id:'wanted',description:'Private original description',contact_email:'owned@example.invalid',image_urls:['saved-photo']};
  const state={kind,initialItemID:'wanted',loading:false,policy:{},initialEdit:ref,mounted:{current:true},endpoint:`/providers/me/${kind}`,token:'owner',useRef:()=>ref,useEffect:fn=>fn(),encodeURIComponent,
   providerRequest:async(_token,url)=>{path=url;return kind==='products'?{items:[{id:'wrong'},snapshot]}:snapshot;},editablePostSnapshot:(_kind,value,id)=>{assert.equal(id,'wanted');return value;},setDraft:value=>{draft=value;},setConfirmed:()=>{},run:fn=>{last=fn();return last;}};
  vm.runInNewContext(compile(catalog.slice(from,to)),state);await last;assert.equal(draft.id,'wanted');assert.equal(draft.description,'Private original description');assert.equal(draft.image_urls[0],'saved-photo');assert.match(path,kind==='products'?/product_id=wanted/:/listings\/wanted$/);
 }
 console.log('Business contact passed: own/staff actions, unrelated customer contact, account switches, stale lookup, error retry and analytics exclusion.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
