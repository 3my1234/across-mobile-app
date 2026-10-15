const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
let slots=[],index=0,effects=[],uuid=0,uuidFails=false,requests=[];
const react={useRef:value=>{const i=index++;return slots[i]??(slots[i]={current:value});},useState:value=>{const i=index++;if(!(i in slots))slots[i]=value;return[slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v;}];},useEffect:(fn,deps)=>{const i=index++;if(!slots[i]||deps.some((v,j)=>slots[i].deps[j]!==v)){effects.push(()=>{slots[i]?.cleanup?.();slots[i]={deps,cleanup:fn()};});}},createElement:(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity)})};
const rn={View:'View',Text:'Text',TextInput:'Input',Pressable:'Pressable',FlatList:'List',ScrollView:'Scroll',Image:'Image',ActivityIndicator:'Spinner',StyleSheet:{create:v=>v},Platform:{OS:'android'},BackHandler:{addEventListener:()=>({remove(){}})},AppState:{currentState:'active'},Alert:{alert:(_title,_text,actions)=>actions.find(a=>a.text==='Choose location').onPress()}};
const deps={'react':react,'react-native':rn,'expo-crypto':{randomUUID:()=>{if(uuidFails)throw new Error('UUID unavailable');return 'uuid-'+ ++uuid;}},'./ThemeProvider':{useTheme:()=>({dark:false,color:x=>x}),useThemedStyles:x=>x,ThemedText:'Text',ThemedTextInput:'Input'},'./foregroundLocation':{currentForegroundLocation:async()=>({coords:{latitude:9.07,longitude:7.49,accuracy:10}})},'./KeyboardFrame':{KeyboardFrame:'Keyboard'},'./ProviderIdentity':{ProviderBanner:'Banner',ProviderBadge:'Badge'},'./ChatPhotoViewer':{ChatPhotoViewer:'Viewer'},'./LocationPin':{LocationPin:'Pin'},'./TownHallMessage':{TownHallMessage:'HallMessage'},'@expo/vector-icons':{Ionicons:'Icon'}};
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
 console.log('Chat composer passed: pending history, duplicate taps, visible progress/error, retained draft, same-reference retry, UUID failure recovery and universal location-only sending.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
