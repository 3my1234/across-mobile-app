const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const source=ts.transpileModule(fs.readFileSync('components/realtimeClient.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const timers=new Map(),sockets=[],appListeners=new Set();let next=0;
class FakeSocket{constructor(url,protocols,options){this.url=url;this.options=options;this.closed=false;this.sent=[];sockets.push(this);}send(value){this.sent.push(JSON.parse(value));}close(){this.closed=true;this.onclose?.();}receive(value){this.onmessage?.({data:JSON.stringify(value)});}}
const app={currentState:'active',addEventListener:(_kind,fn)=>{appListeners.add(fn);return {remove:()=>appListeners.delete(fn)};}};
const ctx={exports:{},WebSocket:FakeSocket,Promise,Math,JSON,setTimeout:(fn,ms)=>{const id=++next;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),require:name=>name==='react-native'?{AppState:app,Platform:{OS:'android'}}:{API_URL:'https://api.example.test'}};
vm.runInNewContext(source,ctx);
(async()=>{
 const events=[],events2=[],unsub=ctx.exports.subscribeRealtime('secret-token',e=>events.push(e)),unsub2=ctx.exports.subscribeRealtime('secret-token',e=>events2.push(e),'hall');
 await Promise.resolve();let [id,timer]=[...timers.entries()][0];timers.delete(id);timer.fn();assert.equal(sockets.length,1,'same account shares a connection');
 assert.equal(sockets[0].url,'wss://api.example.test/api/v1/realtime');assert.ok(!sockets[0].url.includes('secret-token'));assert.equal(sockets[0].options.headers.Authorization,'Bearer secret-token');
 sockets[0].receive({type:'ready'});sockets[0].receive({type:'changed'});assert.deepEqual(events,['connected','changed']);assert.deepEqual(events2,['connected','changed']);
 assert.equal(sockets[0].sent.at(-1).enabled,true,'Town Hall topic enabled only for interested screens');
 app.currentState='background';for(const fn of appListeners)fn('background');assert.equal(sockets[0].closed,true);assert.equal(events.at(-1),'disconnected');
 app.currentState='active';for(const fn of appListeners)fn('active');[id,timer]=[...timers.entries()][0];timers.delete(id);timer.fn();assert.equal(sockets.length,2,'foreground reconnects');
 sockets[1].close();assert.ok([...timers.values()].some(t=>t.ms>=500&&t.ms<=2000),'reconnect is jittered');
 unsub();assert.equal(appListeners.size,1);unsub2();assert.equal(appListeners.size,0);assert.equal(timers.size,0,'last unsubscribe removes timers');
 console.log('Real-time client passed: shared session, header auth, signals, background, jitter and cleanup.');
})().catch(e=>{console.error(e);process.exitCode=1;});
