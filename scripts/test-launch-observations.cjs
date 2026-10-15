const fs=require('fs'),ts=require('typescript'),vm=require('vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('App.tsx','utf8'),ast=ts.createSourceFile('App.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let settings;
function walk(node){
 if(ts.isJsxElement(node)&&node.openingElement.tagName.getText(ast)==='Modal'&&node.openingElement.attributes.getText(ast).includes('showSettings'))settings=node;
 if(ts.isJsxText(node)&&node.text.length&&(!node.text.includes('\n')||node.text.trim())&&ts.isJsxElement(node.parent))assert.ok(['Text','Animated.Text'].includes(node.parent.openingElement.tagName.getText(ast)),`raw text at App.tsx:${ast.getLineAndCharacterOfPosition(node.pos).line+1}`);
 ts.forEachChild(node,walk);
}walk(ast);assert.ok(settings);
function render(dark){
 const noop=()=>{},tree=[];
 const React={createElement:(type,props,...children)=>{const flattened=children.flat(Infinity).filter(v=>v!==null&&v!==undefined&&typeof v!=='boolean');if(type!=='Text')assert.ok(!flattened.some(v=>typeof v==='string'||typeof v==='number'),`raw native text under ${type}`);const item={type,props:props||{},children:flattened};tree.push(item);return item;}};
 const styles=new Proxy({},{get:()=>({})});
 const context={React,Modal:'Modal',View:'View',Text:'Text',ScrollView:'ScrollView',Pressable:'Pressable',Ionicons:'Icon',showSettings:true,insets:{top:24,bottom:16},s:styles,theme:{dark,preference:dark?'dark':'light',color:v=>v,setPreference:noop},setShowSettings:noop,setShowPaymentHistory:noop,setActiveTab:noop,setEditingProfile:noop,soundEnabled:true,notificationStatus:'',toggleNotificationSound:noop,Linking:{openSettings:noop},Alert:{alert:noop},token:'session',privateChatStore:{clear:noop},logout:noop};
 context.ReadReceiptSetting='ReadReceiptSetting';
 context.AccountIcon='AccountIcon';context.AccountSectionHeading='AccountSectionHeading';context.Switch='Switch';context.accountColors={dark,text:dark?'#FFF':'#14231E',accent:'#087B58'};context.accountCard={};context.accountDesign=styles;
 const code=ts.transpileModule('const result='+settings.getText(ast),{compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2020}}).outputText;
 vm.runInNewContext(code,context);assert.ok(tree.some(n=>n.type==='Text'&&n.children.includes('Settings')));
}
render(false);render(true);
assert.equal((source.match(/accessibilityLabel="Open settings"/g)||[]).length,1,'only Account exposes Settings');
assert.ok(source.includes("['home','services','account'].includes(activeTab)"));
assert.ok(!fs.readFileSync('components/NavItems.ts','utf8').includes('key: "track"'));
console.log('Launch screen regression passed: Settings renders without raw native text in both themes; one Account entry; retained-record tracking navigation.');
