const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
let slots=[],index=0,effects=[],uuid=0,uuidFails=false,requests=[],now=Date.now(),gpsReads=0,locationChoice='Use GPS',lastDialog,alerts=[];
let heldGPS=null;
let gpsPosition={timestamp:now,coords:{latitude:9.07,longitude:7.49,accuracy:10}};
const react={useRef:value=>{const i=index++;return slots[i]??(slots[i]={current:value});},useState:value=>{const i=index++;if(!(i in slots))slots[i]=value;return[slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v;}];},useEffect:(fn,deps)=>{const i=index++;if(!slots[i]||deps.some((v,j)=>slots[i].deps[j]!==v)){effects.push(()=>{slots[i]?.cleanup?.();slots[i]={deps,cleanup:fn()};});}},createElement:(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity)})};
const rn={View:'View',Text:'Text',TextInput:'Input',Pressable:'Pressable',FlatList:'List',ScrollView:'Scroll',Image:'Image',ActivityIndicator:'Spinner',StyleSheet:{create:v=>v},Platform:{OS:'android'},BackHandler:{addEventListener:()=>({remove(){}})},AppState:{currentState:'active'},Alert:{alert:(title,text,actions,options)=>{alerts.push({title,text,actions});lastDialog=options;if(actions&&locationChoice)actions.find(a=>a.text===locationChoice)?.onPress();}}};
const deps={'react':react,'react-native':rn,'expo-crypto':{randomUUID:()=>{if(uuidFails)throw new Error('UUID unavailable');return 'uuid-'+ ++uuid;}},'./ThemeProvider':{useTheme:()=>({dark:false,color:x=>x}),useThemedStyles:x=>x,ThemedText:'Text',ThemedTextInput:'Input'},'./foregroundLocation':{currentForegroundLocation:async()=>{gpsReads++;return heldGPS||gpsPosition;}},'./KeyboardFrame':{KeyboardFrame:'Keyboard'},'./ProviderIdentity':{ProviderBanner:'Banner',ProviderBadge:'Badge'},'./ChatPhotoViewer':{ChatPhotoViewer:'Viewer'},'./LocationPin':{LocationPin:'Pin'},'./TownHallMessage':{TownHallMessage:'HallMessage'},'@expo/vector-icons':{Ionicons:'Icon'}};
const compile=s=>ts.transpileModule(s,{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2020}}).outputText;
const policy={exports:{},Number,encodeURIComponent};vm.runInNewContext(compile(fs.readFileSync('components/chatLocation.ts','utf8')),policy);
const captured={exports:{},Number,Date:{now:()=>now},Error,require:name=>name==='expo-location'?{Accuracy:{High:4}}:name==='./chatLocation'?policy.exports:deps[name]};vm.runInNewContext(compile(fs.readFileSync('components/chatLocationCapture.ts','utf8')),captured);
deps['./chatLocationCapture']=captured.exports;deps['./NativeProviderLocationPicker']={NativeProviderLocationPicker:'Picker'};
deps['./messageReceipts']={useMessageReceipts:()=>({})};deps['./MessageReceipt']={MessageReceipt:'Receipt'};
const ctx={exports:{},Error,require:name=>deps[name]||{},requestAnimationFrame:fn=>fn()};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/ProviderConversation.tsx','utf8'),{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,ctx);
const props={token:'buyer',title:'Product',provider:'Seller',messages:[],busy:false,loading:true,paused:false,error:'',hasEarlier:false,bottomInset:0,onClose(){},onEarlier(){},onRefresh(){},onSend:(...args)=>new Promise((resolve,reject)=>requests.push({args,resolve,reject}))};
function render(){index=0;const tree=ctx.exports.ProviderConversation(props);while(effects.length)effects.shift()();return tree;}
function find(tree,predicate){if(!tree||typeof tree!=='object')return;return predicate(tree)?tree:tree.children?.map(child=>find(child,predicate)).find(Boolean);}
const labeled=label=>find(render(),n=>n.props.accessibilityLabel===label);
const send=()=>labeled('Send provider message');
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
async function main(){
 render();labeled('Message provider').props.onChangeText('Hello');assert.equal(send().props.disabled,false,'history loading must not disable typing/sending');
 send().props.onPress();send().props.onPress();assert.equal(requests.length,1,'duplicate tap ignored');assert.equal(send().props.disabled,true);assert.equal(send().children[0].type,'Spinner');
 requests[0].reject(new Error('Network timeout'));await flush();assert.equal(labeled('Message provider').props.value,'Hello');assert.equal(send().props.disabled,false);assert.ok(find(render(),n=>n.props.accessibilityRole==='alert'),'send failure visible');
 send().props.onPress();assert.equal(requests[1].args[2],requests[0].args[2],'lost response retry preserves idempotency reference');requests[1].resolve();await flush();assert.equal(labeled('Message provider').props.value,'');
 uuidFails=true;labeled('Message provider').props.onChangeText('Again');send().props.onPress();await flush();assert.equal(send().props.disabled,false,'UUID exception cannot leave send locked');uuidFails=false;
 send().props.onPress();requests[2].resolve();await flush();
 // A regular product chat, without any driver role, can send a standalone pin.
 labeled('Share location pin').props.onPress();await flush();assert.equal(requests.length,3,'capturing a pin does not send before confirmation');assert.equal(find(render(),n=>n.type==='Pin').props.draft,true);assert.equal(send().props.disabled,false);
 send().props.onPress();assert.equal(requests[3].args[0],'');assert.equal(requests[3].args[3].latitude,9.07);requests[3].resolve();await flush();assert.equal(find(render(),n=>n.type==='Pin'),undefined);
 // Reject an old or imprecise fix before there is any pin to send.
 gpsPosition={timestamp:now-900000,coords:{latitude:9.07,longitude:7.49,accuracy:10}};
 labeled('Share location pin').props.onPress();await flush();assert.equal(find(render(),n=>n.type==='Pin'),undefined);assert.match(alerts.at(-1).text,/old location/);
 gpsPosition={timestamp:now,coords:{latitude:9.07,longitude:7.49,accuracy:4000}};
 labeled('Share location pin').props.onPress();await flush();assert.equal(find(render(),n=>n.type==='Pin'),undefined);assert.match(alerts.at(-1).text,/more accurate/);assert.ok(alerts.at(-1).actions.some(action=>action.text==='Choose on map'),'GPS failure offers a direct manual fallback');
 gpsPosition={timestamp:now,coords:{latitude:9.07,longitude:7.49,accuracy:10}};
 labeled('Message provider').props.onChangeText('Keep my pickup message');labeled('Share location pin').props.onPress();await flush();
 now+=120001;send().props.onPress();await flush();assert.equal(requests.length,4,'an old unsent GPS pin cannot be silently sent');assert.equal(labeled('Message provider').props.value,'Keep my pickup message');assert.ok(find(render(),n=>n.props.accessibilityRole==='alert'));
 gpsPosition={timestamp:now,coords:{latitude:9.08,longitude:7.45,accuracy:10}};labeled('Share location pin').props.onPress();await flush();
 send().props.onPress();assert.equal(requests.length,5);const original=JSON.stringify(requests[4].args[3]),originalID=requests[4].args[2],reads=gpsReads;
 requests[4].reject(Error('Lost acknowledgement'));await flush();now+=600000;gpsPosition={timestamp:now,coords:{latitude:9.3,longitude:7.8,accuracy:10}};
 send().props.onPress();assert.equal(requests[5].args[2],originalID);assert.equal(JSON.stringify(requests[5].args[3]),original,'an uncertain retry must preserve the original static pin after the sender moves');assert.equal(gpsReads,reads,'retry cannot request another GPS fix');requests[5].resolve();await flush();
 locationChoice='Choose on map';labeled('Share location pin').props.onPress();const picker=find(render(),n=>n.type==='Picker');assert.ok(picker);assert.equal(gpsReads,reads,'manual pickup does not require another GPS read');picker.props.onChoose({latitude:9.1,longitude:7.5});now+=3600000;
 send().props.onPress();assert.equal(requests.length,7,'a deliberately chosen map destination remains valid');assert.deepEqual(Object.keys(requests[6].args[3]).sort(),['latitude','longitude']);requests[6].resolve();await flush();
 locationChoice=null;labeled('Share location pin').props.onPress();lastDialog.onDismiss();locationChoice='Use GPS';gpsPosition.timestamp=now;labeled('Share location pin').props.onPress();await flush();assert.equal(gpsReads,reads+1,'dismissing the location dialog cannot leave sharing locked');
 labeled('Remove location pin').props.onPress();let release;heldGPS=new Promise(resolve=>release=resolve);labeled('Share location pin').props.onPress();assert.equal(labeled('Share location pin').props.disabled,true);assert.equal(labeled('Attach photos').props.disabled,true);
 rn.AppState.currentState='background';release(gpsPosition);await flush();assert.equal(find(render(),n=>n.type==='Pin'),undefined,'a background return cannot install a new chat draft');rn.AppState.currentState='active';heldGPS=new Promise(resolve=>release=resolve);
 labeled('Share location pin').props.onPress();props.token='another-account';render();release(gpsPosition);await flush();assert.equal(find(render(),n=>n.type==='Pin'),undefined,'late GPS cannot become a pin for another account');heldGPS=null;
 console.log('Chat composer passed: stale/coarse GPS rejection, first-send freshness, manual map point, dialog dismissal and immutable retry after movement, with existing send/error/idempotency behavior.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
