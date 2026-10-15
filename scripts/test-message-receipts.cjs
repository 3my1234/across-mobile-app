const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),ts=require('typescript');
const own='11111111-1111-4111-8111-111111111111',incoming='22222222-2222-4222-8222-222222222222',room='33333333-3333-4333-8333-333333333333';
let slots=[],index=0,effects=[],tasks=new Map(),listeners={},sequence=0,calls=[],state='sent',defer=false,pending;
const react={useRef:v=>{const i=index++;return slots[i]??(slots[i]={current:v});},useState:v=>{const i=index++;if(!(i in slots))slots[i]=v;return[slots[i],value=>slots[i]=typeof value==='function'?value(slots[i]):value];},useEffect:(fn,deps)=>{const i=index++;if(!slots[i]||deps.some((v,j)=>slots[i].deps[j]!==v)){effects.push(()=>{slots[i]?.cleanup?.();slots[i]={deps,cleanup:fn()};});}},createElement:(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity)})};
const native={AppState:{currentState:'active',addEventListener:(_name,fn)=>{listeners.foreground=fn;return{remove:()=>delete listeners.foreground};}},DeviceEventEmitter:{addListener:(name,fn)=>{listeners[name]=fn;return{remove:()=>delete listeners[name]};}},View:'View'};
const request=async(token,path,options={})=>{calls.push({token,path,options});if(options.method==='POST')return {data:{}};if(defer)return new Promise(resolve=>pending=resolve);return {data:{items:{[own]:{status:state,delivered_count:state==='sent'?0:1,read_count:state==='read'?1:0}}}};};
function load(file,deps,globals={}){const ctx={exports:{},require:name=>deps[name],...globals};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText,ctx);return ctx.exports;}
const hook=load('components/messageReceipts.ts',{'react':react,'react-native':native,'./communityApi':{communityRequest:request}},{URLSearchParams,Set,setInterval:fn=>{tasks.set(++sequence,fn);return sequence;},clearInterval:id=>tasks.delete(id)});
let token='buyer',visible=[];function render(){index=0;const result=hook.useMessageReceipts(token,{channel:'business',conversationId:room},[{id:own,mine:true},{id:incoming,mine:false}],visible);while(effects.length)effects.shift()();return result;}
async function flush(){for(let i=0;i<12;i++)await Promise.resolve();}
async function main(){
 render();await flush();assert.equal(render()[own].status,'sent');
 const first=calls.filter(c=>c.options.method==='POST');assert.equal(first.length,1);assert.equal(JSON.parse(first[0].options.body).read,false);assert.deepEqual(JSON.parse(first[0].options.body).message_ids,[incoming]);
 visible=[incoming,own];state='delivered';render();await flush();assert.equal(render()[own].status,'delivered');assert.equal(calls.filter(c=>c.options.method==='POST'&&JSON.parse(c.options.body).read).length,1);
 for(const fn of tasks.values())fn();await flush();assert.equal(calls.filter(c=>c.options.method==='POST').length,2,'receipt acknowledgement is deduplicated');
 state='read';for(const fn of tasks.values())fn();await flush();assert.equal(render()[own].status,'read');
 defer=true;for(const fn of tasks.values())fn();await flush();assert.equal(typeof pending,'function');listeners['message-receipts-preference']();assert.equal(Object.keys(render()).length,0);pending({data:{items:{[own]:{status:'read',read_count:1}}}});await flush();assert.equal(Object.keys(render()).length,0,'late pre-opt-out response cannot restore blue ticks');
 defer=false;state='delivered';for(const fn of tasks.values())fn();await flush();assert.equal(render()[own].status,'delivered');
 native.AppState.currentState='background';const before=calls.length;for(const fn of tasks.values())fn();await flush();assert.equal(calls.length,before,'no background receipt polling');native.AppState.currentState='active';
 defer=true;for(const fn of tasks.values())fn();await flush();token='another-account';render();pending({data:{items:{[own]:{status:'read'}}}});await flush();assert.equal(Object.keys(render()).length,0,'account change ignores old receipt response');
 for(const slot of slots)slot?.cleanup?.();assert.equal(tasks.size,0);
 slots=[];effects=[];tasks.clear();calls=[];listeners={};token='buyer';defer=false;
 let previews=[{id:room,source:'legacy',last_message:'Hello',last_message_id:incoming,last_message_is_mine:false},{id:room,source:'legacy',last_message:'My message',last_message_id:own,last_message_is_mine:true}];
 function inbox(){index=0;hook.useInboxDeliveryReceipts(token,previews);while(effects.length)effects.shift()();}
 inbox();await flush();assert.equal(calls.length,1);assert.equal(calls[0].path,'/messaging/deliveries');assert.equal(JSON.parse(calls[0].options.body).messages.length,1);assert.equal(JSON.parse(calls[0].options.body).read,undefined,'inbox batch cannot mark read');for(const fn of tasks.values())fn();await flush();assert.equal(calls.length,1,'same inbox preview is not reacknowledged');
 for(const slot of slots)slot?.cleanup?.();slots=[];effects=[];tasks.clear();listeners={};
 native.DeviceEventEmitter.emit=name=>listeners[name]?.();native.Switch='Switch';native.ActivityIndicator='Spinner';let saved;
 const setting=load('components/ReadReceiptSetting.tsx',{'react':react,'react-native':native,'./ThemeProvider':{ThemedText:'Text'},'./communityApi':{communityRequest:async(_token,_path,options={})=>{if(options.body)saved=JSON.parse(options.body).read_receipts_enabled;return {data:{read_receipts_enabled:saved??true}};}}});
 function settingTree(){index=0;const tree=setting.ReadReceiptSetting({token:'buyer',active:true});while(effects.length)effects.shift()();return tree;}
 const find=(tree,test)=>tree&&typeof tree==='object'&&(test(tree)?tree:tree.children?.map(n=>find(n,test)).find(Boolean));
 settingTree();await flush();const toggle=find(settingTree(),n=>n.type==='Switch');assert.equal(toggle.props.value,true);toggle.props.onValueChange(false);await flush();assert.equal(saved,false);assert.equal(find(settingTree(),n=>n.type==='Switch').props.value,false,'read setting waits for a saved server acknowledgement');for(const slot of slots)slot?.cleanup?.();
 const ui=load('components/MessageReceipt.tsx',{'react':react,'react-native':native,'@expo/vector-icons':{Ionicons:'Icon'},'./ThemeProvider':{useTheme:()=>({dark:false}),ThemedText:'Text'}});
 const sent=ui.MessageReceipt({receipt:{status:'sent'}}),delivered=ui.MessageReceipt({receipt:{status:'delivered'}}),read=ui.MessageReceipt({receipt:{status:'read'}});
 assert.equal(sent.children[0].props.name,'checkmark');assert.equal(delivered.children[0].props.name,'checkmark-done');assert.equal(read.children[0].props.name,'checkmark-done');assert.notEqual(delivered.children[0].props.color,read.children[0].props.color);assert.equal(read.props.accessibilityLabel,'Read');
 assert.match(ui.MessageReceipt({receipt:{status:'read',read_count:3,delivered_count:4},group:true}).props.accessibilityLabel,/seen by 3/);
 const homeCalls=[];let releaseHome;native.AppState.currentState='active';
 const notificationModule=load('components/messageReceipts.ts',{'react':react,'react-native':native,'./communityApi':{communityRequest:async(_token,path,options={})=>{homeCalls.push({path,options});if(options.method)return {data:{}};return new Promise(resolve=>releaseHome=resolve);}}});
 const home=notificationModule.acknowledgeNotificationDelivery('buyer',{conversation_id:room}),duplicate=notificationModule.acknowledgeNotificationDelivery('buyer',{conversation_id:room});assert.equal(homeCalls.length,1,'foreground notification burst shares one history fetch');assert.match(homeCalls[0].path,/mark_read=false/);
 releaseHome({data:{items:[{id:incoming},{id:'invalid'}]}});await Promise.all([home,duplicate]);assert.equal(homeCalls.length,2);assert.equal(homeCalls[1].path,'/messaging/deliveries');const homeBody=JSON.parse(homeCalls[1].options.body);assert.equal(homeBody.messages.length,1);assert.equal(homeBody.read,undefined,'Home delivery never publishes a read');
 native.AppState.currentState='background';await notificationModule.acknowledgeNotificationDelivery('buyer',{conversation_id:room});assert.equal(homeCalls.length,2,'closed/background app does not fake delivery');native.AppState.currentState='active';
 console.log('Message receipts passed: explicit device ack, viewport-only read, deduplication, ticks, group counts, opt-out race, account isolation and foreground-only polling.');
}
main().catch(error=>{console.error(error,calls);process.exitCode=1;});
