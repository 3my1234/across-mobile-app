const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const compile=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText;
const parse=file=>ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const find=(node,predicate)=>{const result=[];function walk(n){if(predicate(n))result.push(n);ts.forEachChild(n,walk);}walk(node);return result;};
let hooks=[],index=0;
const react={useRef:initial=>hooks[index++]||(hooks[index-1]={current:initial}),createElement:(type,props,...children)=>({type,props:{...props,children}})};
const scope={exports:{},require:name=>name==='react'?react:{View:'View'}};
vm.runInNewContext(compile(fs.readFileSync('components/RetainedFeedTab.tsx','utf8')),scope);
const image={type:'LoadedPhoto',cacheKey:'public-photo-v1'},feed={type:'VirtualizedFeed',scrollOffset:600,image};
function render(active){index=0;return scope.exports.RetainedFeedTab({active,children:feed});}
assert.equal(render(false),null,'unvisited services do not mount or fetch in the background');
let tree=render(true);assert.equal(tree.props.children[0],feed);
for(let i=0;i<3;i++){
 tree=render(false);assert.equal(tree.props.children[0],feed,'tab switches retain the feed and its loaded images');
 assert.equal(tree.props.style.height,'100%','hidden viewport never collapses to zero');
 assert.equal(tree.props.pointerEvents,'none');assert.equal(tree.props.accessibilityElementsHidden,true);
 assert.equal(tree.props.importantForAccessibility,'no-hide-descendants');
 tree=render(true);assert.equal(tree.props.children[0].scrollOffset,600);assert.equal(tree.props.children[0].image,image);
 assert.equal(tree.props.pointerEvents,'auto');assert.equal(tree.props.accessibilityElementsHidden,false);
}
hooks=[];assert.equal(render(false),null,'a replacement account starts with no retained view');

// Check the real App wiring, including account-owned keys. A conditional outside
// these wrappers would defeat retention, even if the component itself passed.
const app=parse('App.tsx'),wrappers=find(app,n=>ts.isJsxElement(n)&&n.openingElement.tagName.getText(app)==='RetainedFeedTab');
assert.equal(wrappers.length,2);
for(const wrapper of wrappers){
 const key=wrapper.openingElement.attributes.properties.find(p=>p.name?.getText(app)==='key');
 assert.ok(key.initializer.expression.getText(app).includes('token'),'retained state belongs to its account');
 const directChildren=wrapper.children.filter(ts.isJsxSelfClosingElement);
 assert.equal(directChildren.length,1,'feed is an unconditional child, not unmounted by tab selection');
}
assert.equal(wrappers[0].children.filter(ts.isJsxSelfClosingElement)[0].tagName.getText(app),'Animated.FlatList');
assert.equal(wrappers[1].children.filter(ts.isJsxSelfClosingElement)[0].tagName.getText(app),'MarketplaceScreen');

// Execute the actual service loading and polling effects with a fake clock.
// Hidden services must not create any timers, API reads or foreground listeners.
const marketplace=parse('components/MarketplaceScreen.tsx');
const callbacks=find(marketplace,n=>ts.isCallExpression(n)&&n.expression.getText(marketplace)==='useEffect').map(n=>n.arguments[0]);
const loading=callbacks.find(n=>n.getText(marketplace).includes('const timer = setTimeout'));
const polling=callbacks.find(n=>n.getText(marketplace).includes('let stopped=false, busy=false'));
assert.ok(loading);assert.ok(polling);
let calls=0,subscriptions=0,next=0;const timers=new Map();
const context={active:false,token:'buyer',mode:'explore',chatBusy:{current:false},threadInFlight:{current:false},conversationRef:{current:null},threadLoader:{current:async()=>{}},
 loadListings:()=>calls++,loadRequests:()=>calls++,loadConversations:()=>calls++,
 setTimeout:fn=>{timers.set(++next,fn);return next;},clearTimeout:id=>timers.delete(id),setInterval:fn=>{timers.set(++next,fn);return next;},clearInterval:id=>timers.delete(id),
 AppState:{currentState:'active',addEventListener:()=>{subscriptions++;return{remove(){subscriptions--;}};}}};
function effect(node){return vm.runInNewContext(compile('('+node.getText(marketplace)+')'),context)();}
assert.equal(effect(loading),undefined);assert.equal(effect(polling),undefined);assert.equal(timers.size,0);assert.equal(subscriptions,0);assert.equal(calls,0);
context.active=true;const cleanLoad=effect(loading),cleanPoll=effect(polling);assert.equal(timers.size,2);assert.equal(subscriptions,1);
timers.values().next().value();assert.equal(calls,1,'visible services still load');
cleanLoad();cleanPoll();assert.equal(timers.size,0);assert.equal(subscriptions,0,'leaving the tab removes polling and foreground listeners');
context.active=false;effect(loading);effect(polling);assert.equal(timers.size,0);
console.log('Retained feeds passed: lazy mount, stable image/scroll state, account isolation, hidden accessibility and service timer cleanup.');
