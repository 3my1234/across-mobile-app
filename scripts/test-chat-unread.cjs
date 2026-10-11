const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const source=fs.readFileSync('components/MarketplaceScreen.tsx','utf8');
const transpile=code=>ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
let chats=[{id:'chat',unread_count:3}],ackCount=0,fail=false,resolveAck;
const g={token:'buyer',threadRequest:{current:0},threadInFlight:{current:false},chatActor:{current:'buyer'},conversationRef:{current:{id:'chat'}},AppState:{currentState:'active'},API_URL:'https://example.test',authHeaders:{},URLSearchParams,
setChatLoading(){},setConversationMessages(){},setConversationCursor(){},setChatError(){},mergeChatMessages:(a,b)=>b,
setConversations(fn){chats=fn(chats)},apiMessage:()=> 'failed',fetchHistoryJSON:async()=>({response:{ok:!fail},body:{items:[{id:'message',created_at:'2026-10-11'}]}}),
fetchJSONWithTimeout:async(url,options)=>{assert.match(url,/chat\/read$/);assert.equal(JSON.parse(options.body).message_id,'message');ackCount++;return new Promise(resolve=>resolveAck=resolve)}};
vm.createContext(g);vm.runInContext(transpile(source.slice(source.indexOf('  async function loadConversationMessages('),source.indexOf('  async function openConversation('))),g);
(async()=>{
 const first=g.loadConversationMessages({id:'chat'});await new Promise(r=>setImmediate(r));assert.equal(chats[0].unread_count,3,'must stay unread until acknowledged');resolveAck({response:{ok:true},body:{unread_count:1}});await first;assert.equal(chats[0].unread_count,1,'newer arrivals remain unread');
 fail=true;await g.loadConversationMessages({id:'chat'});assert.equal(ackCount,1);assert.equal(chats[0].unread_count,1,'failed fetch must not clear unread');
 fail=false;g.AppState.currentState='background';await g.loadConversationMessages({id:'chat'});assert.equal(ackCount,1,'hidden app must not acknowledge');
 g.AppState.currentState='active';const late=g.loadConversationMessages({id:'chat'});await new Promise(r=>setImmediate(r));g.chatActor.current='other';resolveAck({response:{ok:true},body:{unread_count:0}});await late;assert.equal(chats[0].unread_count,1,'stale session acknowledgement must not update visible list');
 console.log('Unread chat passed: acknowledged reads, newer arrivals, failed loads, hidden app and stale sessions.');
})().catch(e=>{console.error(e);process.exitCode=1});
