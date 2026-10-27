const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const compile=s=>ts.transpileModule(s,{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2020}}).outputText;
const flatten=style=>Array.isArray(style)?Object.assign({},...style.map(flatten)):style||{};
let slots=[],index=0,effects=[],tasks=new Map(),seq=0,listeners={},focus=true,revealed=[],scrolls=[],mode='input';
const input={isFocused:()=>focus},container={getScrollResponder:()=>({scrollResponderScrollNativeHandleToKeyboard:(...args)=>scrolls.push(args)})};
const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
const react={createContext:value=>({value,Provider:'Context'}),useContext:ctx=>ctx.value,useRef:value=>{const i=index++;return slots[i]||(slots[i]={current:value});},useState:value=>{const i=index++;if(!(i in slots))slots[i]=value;return[slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v;}];},useEffect:(fn,deps)=>{const i=index++;if(!slots[i]||!same(slots[i].deps,deps)){const old=slots[i];slots[i]={deps};effects.push(()=>{old?.cleanup?.();slots[i].cleanup=fn();});}},useCallback:(fn,deps)=>{const i=index++;if(!slots[i]||!same(slots[i].deps,deps))slots[i]={deps,fn};return slots[i].fn;},forwardRef:fn=>fn,createElement:(type,props,...children)=>{if(typeof props?.ref==='function')props.ref(type==='Input'?input:container);return {type,props:props||{},children};}};
const keyboard={addListener:(name,fn)=>{listeners[name]=fn;return{remove:()=>delete listeners[name]};}};
const RN={TextInput:Object.assign(()=>{},{State:{currentlyFocusedInput:()=>focus?input:null}}),ScrollView:'Scroll',FlatList:'List',findNodeHandle:n=>n===input?17:null,Keyboard:keyboard,Platform:{OS:'android'},StyleSheet:{flatten},Alert:{},Text:'Text'};
// Render the real themed input, forwarding every caller event and ref.
RN.TextInput='Input';const revealContext={value:n=>revealed.push(n)};
const ctx={exports:{},require:name=>name==='react'?react:name==='react-native'?RN:name==='./KeyboardScroll'?{InputScrollContext:revealContext}:name==='./typography'?{compactTypography:()=>({})}:{},setTimeout,clearTimeout};vm.runInNewContext(compile(fs.readFileSync('components/ThemeProvider.tsx','utf8')),ctx);
let props={multiline:true,value:'A message that grows beyond two lines',style:{minHeight:44,maxHeight:120},onContentSizeChange:()=>events++,onSelectionChange:()=>events++,onFocus:()=>events++},events=0,ref={current:null};
function render(){index=0;effects=[];const tree=ctx.exports.ThemedTextInput(props,ref);effects.forEach(f=>f());return tree;}
let tree=render();assert.equal(ref.current,input,'preserve caller native focus ref');tree.props.onFocus({});assert.equal(revealed.at(-1),input);
tree.props.onContentSizeChange({nativeEvent:{contentSize:{width:180,height:78}}});tree=render();assert.equal(flatten(tree.props.style).height,80,'grow to fit a three-line draft');assert.equal(tree.props.value,props.value,'growth cannot truncate or replace draft');assert.equal(flatten(tree.props.style).textAlignVertical,'top');
tree.props.onContentSizeChange({nativeEvent:{contentSize:{height:600}}});tree=render();assert.equal(flatten(tree.props.style).height,120,'long drafts remain bounded so the composer cannot cover the thread');tree.props.onSelectionChange({});assert.equal(events,4,'preserve focus/content/selection handlers');
props={...props,value:''};render();tree=render();assert.equal(flatten(tree.props.style).height,44,'successful send can collapse the editor');tree.props.onBlur({});assert.equal(revealed.at(-1),null);
props={...props,multiline:false,style:{height:50}};tree=render();assert.equal(flatten(tree.props.style).height,50,'preserve explicit and single-line dimensions');
// Exercise actual nearest-scroll coordinator and native keyboard/layout events.
slots=[];index=0;effects=[];RN.TextInput={State:{currentlyFocusedInput:()=>focus?input:null}};
const scope={exports:{},require:name=>name==='react'?react:RN,setTimeout:fn=>{tasks.set(++seq,fn);return seq;},clearTimeout:id=>tasks.delete(id)};vm.runInNewContext(compile(fs.readFileSync('components/KeyboardScroll.tsx','utf8')),scope);
function scrollRender(list=false){index=0;effects=[];const tree=(list?scope.exports.KeyboardFlatList:scope.exports.KeyboardScrollView)({children:'form'},null);effects.forEach(f=>f());return tree;}
const flush=()=>{const batch=[...tasks.values()];tasks.clear();batch.forEach(fn=>fn());};
let scroll=scrollRender(),provider=scroll.children[0];provider.props.value(input);provider.props.value(input);flush();assert.equal(scrolls.length,1,'coalesce focus/selection/growth without a scrolling storm');assert.deepEqual(scrolls[0],[17,20,true]);
listeners.keyboardDidShow();flush();assert.equal(scrolls.length,2,'reveal again after the keyboard finishes opening');scroll.props.onLayout({});flush();assert.equal(scrolls.length,3,'reveal after native viewport resize');focus=false;provider.props.value(input);flush();assert.equal(scrolls.length,3,'stale or blurred inputs cannot move a new form');
focus=true;provider.props.value(input);slots.forEach(s=>s?.cleanup?.());assert.equal(tasks.size,0);assert.equal(Object.keys(listeners).length,0,'unmount removes keyboard listeners');
slots=[];index=0;effects=[];scroll=scrollRender(true);assert.equal(scroll.type,'Context','virtualized list headers inherit the same focus coordinator');scroll.props.value(input);flush();assert.equal(scrolls.length,4);slots.forEach(s=>s?.cleanup?.());
console.log('Keyboard inputs passed: multiline growth/cap, retained draft, caller events/ref, reset, nearest-scroll reveal, post-keyboard/layout reveal, coalescing, stale focus and cleanup. Physical device acceptance remains required.');
