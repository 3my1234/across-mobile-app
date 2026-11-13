const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const compile=file=>ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText;
const policy={exports:{},URL};vm.runInNewContext(compile('components/nativeProviderPolicy.ts'),policy);
const p=policy.exports;let history=false,dark=false,selected=[],viewed=[];
const react={useState:()=>[history,value=>history=typeof value==='function'?value(history):value],createElement:(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity)})};
const scope={exports:{},require:name=>name==='react'?react:name==='react-native'?{View:'View',Pressable:'Button'}:name==='./nativeProviderPolicy'?p:name==='./AccountDesign'?{useAccountDesign:()=>({dark,accent:'#087B58',danger:'#B42332',soft:'#E3F8EF',line:'#345047',muted:'#5B6B63'})}:name==='@expo/vector-icons'?{Ionicons:'Icon'}:{ThemedText:'Text'}};
vm.runInNewContext(compile('components/ProviderVerificationDocuments.tsx'),scope);
const nodes=n=>!n||typeof n!=='object'?[]:[n,...(n.children||[]).flatMap(nodes)];
const text=n=>typeof n==='string'||typeof n==='number'?String(n):n?.children?.map(text).join('')||'';
const draw=(driver,documents=[],busy=false)=>scope.exports.ProviderVerificationDocuments({driver,documents,busy,onSelect:kind=>selected.push(kind),onView:id=>viewed.push(id)});
const button=(tree,label)=>{const node=nodes(tree).find(n=>n.type==='Button'&&n.props.accessibilityLabel===label);assert.ok(node,'missing '+label);return node;};
const doc=(kind,status='approved',extra={})=>({id:kind,document_type:kind,status,created_at:'2026-11-13T10:00:00Z',...extra});
for(dark of [false,true]){
 history=false;let tree=draw(false);
 assert.match(text(tree),/Government-issued ID/);assert.ok(!/Clear face photo|Vehicle photo|Plate number|LASRRA|insurance|roadworthiness/i.test(text(tree)),'ordinary provider sees ID only');
 button(tree,'Upload ID').props.onPress();assert.equal(selected.at(-1),'government_id');
 tree=draw(true);assert.match(text(tree),/0 of 5 required documents submitted/);
 assert.ok(!/LASRRA|LASDRI|insurance|roadworthiness/i.test(text(tree)));
 for(const row of p.verificationChecklist(true)){button(tree,'Upload '+row.label).props.onPress();assert.equal(selected.at(-1),row.kind);}
 assert.equal(new Set(selected.slice(-5)).size,5,'five independent upload actions, no duplicate ID');
 const documents=[doc('drivers_license','approved',{expires_on:'2030-12-31'}),doc('driver_face','pending'),doc('driver_vehicle'),doc('driver_plate','approved',{id:'old-plate',created_at:'2026-11-12T10:00:00Z'}),doc('driver_plate','rejected',{review_notes:'Plate is blurry'})];
 tree=draw(true,documents);assert.match(text(tree),/3 of 5 required documents submitted/);assert.match(text(tree),/Under review/);assert.match(text(tree),/Needs replacement/);assert.match(text(tree),/Plate is blurry/);
 const progress=nodes(tree).find(n=>n.props.accessibilityRole==='progressbar');assert.equal(progress.props.accessibilityValue.now,3);assert.equal(progress.props.accessibilityValue.max,5);
 button(tree,'View Clear face photo').props.onPress();assert.equal(viewed.at(-1),'driver_face');
 button(tree,'Replace Plate number').props.onPress();assert.equal(selected.at(-1),'driver_plate');
 assert.ok(!nodes(tree).some(n=>n.type==='Image'),'private evidence is opened on demand, never prefetched into the public image cache');
 tree=draw(true,documents,true);assert.ok(nodes(tree).filter(n=>n.type==='Button').every(n=>n.props.disabled),'busy state prevents overlapping selection or submission');
 const expired=doc('drivers_license','approved',{expires_on:'2020-01-01'});assert.equal(p.verificationDocumentStatus(expired,'drivers_license').label,'Expired');
 const missingExpiry=doc('drivers_license');assert.equal(p.verificationDocumentStatus(missingExpiry,'drivers_license').submitted,false);
 const ordinary=[doc('government_id','rejected'),documents[0]];tree=draw(false,ordinary);assert.match(text(tree),/Approved/);button(tree,'View submitted ID').props.onPress();assert.equal(viewed.at(-1),'drivers_license','valid licence counts as identification despite a rejected alternative');
 tree=draw(true,[...documents,doc('vehicle_insurance','approved')]);button(tree,'Submission history').props.onPress();tree=draw(true,[...documents,doc('vehicle_insurance','approved')]);assert.match(text(tree),/Vehicle insurance/);assert.match(text(tree),/Previous submission. Not an additional requirement/);button(tree,'View submission vehicle_insurance').props.onPress();assert.equal(viewed.at(-1),'vehicle_insurance','historical documents remain accessible');
}
assert.equal(p.verificationChecklist(false).length,1);assert.equal(p.verificationChecklist(true).length,5);
console.log('Verification checklist passed: role-specific requirements, licence-as-ID, latest rejection/expiry, progress, review feedback, source actions, busy protection, private previews and preserved history in both themes.');
