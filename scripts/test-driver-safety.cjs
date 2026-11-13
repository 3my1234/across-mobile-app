const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript'), assert = require('node:assert/strict');
const compile = path => ts.transpileModule(fs.readFileSync(path, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true}}).outputText;
const policy = {exports: {}, URL, URLSearchParams}; vm.runInNewContext(compile('components/nativeProviderPolicy.ts'), policy);
const p = policy.exports, now = Date.parse('2026-11-13T12:00:00Z');
assert.equal(p.requiredDriverDocuments({country_code:'NG',state:'Abuja'}).length,7);
assert.equal(p.requiredDriverDocuments({country_code:'NG',state:' Lagos State '}).length,9);
assert.equal(p.requiredDriverDocuments({country_code:'GB',state:'Lagos'}).length,7,'local permits must not leak across countries');
for (const kind of ['driver_face','driver_vehicle','driver_plate','drivers_license','vehicle_registration','vehicle_insurance','roadworthiness','driver_lasrra','driver_lasdri']) {
  assert.ok(p.verificationKinds.some(([value]) => value === kind));
  assert.ok(p.verificationFileError(kind,'application/pdf',1000),'driver evidence requires a photo');
  assert.equal(p.verificationFileError(kind,'image/jpeg',1000),'');
}
for (const kind of ['drivers_license','vehicle_insurance','roadworthiness']) {
  for (const date of ['', '2026-11-12','2026-02-30','invalid']) assert.ok(p.verificationExpiryError(kind,date,now));
  assert.equal(p.verificationExpiryError(kind,'2026-11-13',now),'','valid through the printed date');
}
assert.equal(p.verificationExpiryError('driver_face','',now),'');

let hooks=[],index=0,effects=[],changed=false,pending=[],tree,closed=0,opened=0,token='buyer',listingID='driver-one',expiration;
const same=(a,b)=>a?.length===b?.length&&a.every((value,i)=>value===b[i]);
const react={createElement:(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity)}),
  useState:initial=>{const i=index++;if(!(i in hooks))hooks[i]=initial;return[hooks[i],next=>{hooks[i]=typeof next==='function'?next(hooks[i]):next;changed=true;}];},
  useEffect:(fn,deps)=>{const i=index++;if(!hooks[i]||!same(hooks[i].deps,deps)){const previous=hooks[i];hooks[i]={deps};effects.push(()=>{previous?.cleanup?.();hooks[i].cleanup=fn();});}}};
const context={exports:{},URL,AbortController,encodeURIComponent,setTimeout:(fn,ms)=>{assert.equal(ms,300000);expiration=fn;return 1;},clearTimeout:()=>{expiration=null;},require:name=>name==='react'?react:name==='react-native'?{ActivityIndicator:'Loading',Modal:'Modal',Pressable:'Button',ScrollView:'Scroll',View:'View'}:name==='react-native-safe-area-context'?{SafeAreaView:'SafeArea'}:name==='./ThemeProvider'?{ThemedText:'Text',useTheme:()=>({color:value=>value})}:name==='./config'?{API_URL:'https://api.test'}:name==='./utils'?{fetchJSONWithTimeout:(url,options)=>new Promise(resolve=>pending.push({url,options,resolve}))}:name==='./ResilientImage'?{ResilientImage:'Photo'}:{TransportSafetyNotice:'Safety'}};
vm.runInNewContext(compile('components/DriverSafetyProfile.tsx'),context);
function render(){for(let i=0;i<5;i++){index=0;effects=[];changed=false;tree=context.exports.DriverSafetyProfile({token,listingID,onClose(){closed++;},onOpenService(){opened++;}});effects.forEach(fn=>fn());if(!changed)return;}throw Error('render loop');}
async function settle(){for(let i=0;i<4;i++){await new Promise(resolve=>setImmediate(resolve));if(changed)render();}}
const nodes=node=>!node||typeof node!=='object'?[]:[node,...(node.children||[]).flatMap(nodes)];
const text=node=>typeof node==='string'?node:node?.children?.map(text).join('')||'';
const profile={driver_name:'Actual driver',face_photo_url:'https://bucket.s3.test/private/face.jpg?signature=one',vehicle_photo_url:'https://bucket.s3.test/private/car.jpg?signature=two',plate_photo_url:'https://bucket.s3.test/private/plate.jpg?signature=three',expires_in:300};
(async()=>{
  render();assert.equal(pending.length,1);assert.equal(pending[0].options.headers.Authorization,'Bearer buyer');assert.match(pending[0].url,/driver-one\/safety-profile$/);
  pending[0].resolve({response:{ok:true},body:profile});await settle();
  const photos=nodes(tree).filter(n=>n.type==='Photo');assert.equal(photos.length,3);assert.equal(photos[0].props.uri,profile.face_photo_url);assert.ok(photos.every(n=>n.props.cachePolicy==='memory'&&n.props.fallbackUri===''),'reviewed photos never substitute a business avatar or use public disk persistence');
  nodes(tree).find(n=>n.type==='Button'&&text(n)==='View service and chat').props.onPress();assert.equal(opened,1);
  token='other-buyer';render();assert.ok(pending[0].options.signal.aborted);assert.equal(nodes(tree).filter(n=>n.type==='Photo').length,0,'account change clears photos immediately');
  listingID='driver-two';render();assert.ok(pending[1].options.signal.aborted);pending[1].resolve({response:{ok:true},body:profile});await settle();assert.equal(nodes(tree).filter(n=>n.type==='Photo').length,0,'late old-account response cannot populate the new profile');
  pending[2].resolve({response:{ok:false,status:404},body:{}});await settle();assert.ok(text(tree).includes('Reviewed photos are unavailable'));assert.equal(nodes(tree).filter(n=>n.type==='Photo').length,0);
  nodes(tree).find(n=>n.type==='Button'&&text(n)==='Retry driver photos').props.onPress();render();assert.equal(pending.length,4);pending[3].resolve({response:{ok:true},body:profile});await settle();assert.equal(nodes(tree).filter(n=>n.type==='Photo').length,3);
  for(const url of ['http://unsafe/photo','javascript:bad','https://user:password@test/photo']) assert.equal(context.exports.validDriverSafetyProfile({...profile,face_photo_url:url}),false);
  expiration();await settle();assert.equal(nodes(tree).filter(n=>n.type==='Photo').length,0,'expired links never leave stale reviewed photos displayed');
  hooks.forEach(h=>h?.cleanup?.());assert.ok(pending[3].options.signal.aborted);
  console.log('Driver safety passed: required evidence/expiry/local permits, reviewed-photo projection, private cache, token/navigation races, retry and cancellation.');
})().catch(error=>{console.error(error);process.exitCode=1;});
