/* global __dirname */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const source=fs.readFileSync(path.join(__dirname,'../components/MarketplaceScreen.tsx'),'utf8');
function run(code,globals){const ctx=vm.createContext(globals);vm.runInContext(ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,ctx);return ctx;}
async function main(){
 const labels=run(fs.readFileSync(path.join(__dirname,'../components/servicePricing.ts'),'utf8').replace('export function','function'),{});
 assert.match(labels.servicePriceLabel({price:1000,currency_code:'NGN',attributes:{price_mode:'from'}}),/^From /);
 assert.equal(labels.servicePriceLabel({price:null,currency_code:'NGN'}),'Ask for a quote');
 const pending=[];let conversation=null,messages=[];
 const listing={id:'service',title:'Repairs',provider_name:'Provider'};
 const g={selected:listing,selectedRef:{current:listing},loading:false,token:'buyer',chatActor:{current:'buyer'},authHeaders:{Authorization:'Bearer buyer'},API_URL:'https://example.test',URLSearchParams,encodeURIComponent,Date,Map,Array,
  conversationRef:{current:null},chatBusy:{current:false},threadInFlight:{current:false},threadRequest:{current:0},
  fetchWithTimeout:(url,options)=>new Promise(resolve=>pending.push({url,options,resolve})),apiMessage:(_,fallback)=>fallback,
  setLoading:()=>{},setChatSending:()=>{},setChatLoading:()=>{},setChatError:()=>{},setConversationCursor:()=>{},setConversations:()=>{},
  setSelectedConversation:value=>{conversation=value;},setConversationMessages:value=>{messages=typeof value==='function'?value(messages):value;},loadConversations:async()=>{},Alert:{alert:()=>{throw Error('Unexpected alert');}}};
 const ctx=run(source.slice(source.indexOf('  async function startConversation()'),source.indexOf('  useEffect(()=>{',source.indexOf('  async function startConversation()'))),g);
 const first=ctx.startConversation();assert.equal(pending[0].options.method,undefined,'opening chat must not send an empty enquiry');pending.shift().resolve({ok:true,json:async()=>({items:[]})});await first;assert.equal(conversation.id,'');assert.equal(conversation.listing_id,'service');
 const send=ctx.sendConversationMessage('Hello');assert.match(pending[0].url,/listings\/service\/conversations$/);assert.equal(JSON.parse(pending[0].options.body).message,'Hello');pending.shift().resolve({ok:true,json:async()=>({id:'thread'})});await new Promise(r=>setImmediate(r));assert.match(pending[0].url,/thread\/messages\?limit=50/);pending.shift().resolve({ok:true,json:async()=>({items:[{id:'new',created_at:'2026-10-06T10:00:00Z',body:'Hello'}]})});await send;assert.equal(messages[0].id,'new');
 const late=ctx.sendConversationMessage('Follow-up');g.conversationRef.current=null;pending.shift().resolve({ok:true,json:async()=>({})});await late;assert.equal(g.conversationRef.current,null,'a late send must not reopen a chat the buyer left');
 g.conversationRef.current=conversation;const old=ctx.loadConversationMessages(conversation);g.chatActor.current='another-buyer';pending.shift().resolve({ok:true,json:async()=>({items:[{id:'private'}]})});await old;assert.equal(messages[0].id,'new','another buyer must not receive old-session messages');
 console.log('Provider chat passed: open without enquiry, send, retrieve latest replies, navigation and account isolation; pricing labels passed.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
