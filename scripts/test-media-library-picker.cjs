const fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm'),assert=require('node:assert/strict');
let launch,calls=[],alerts=[],permissionCalls=0;
const platform={OS:'android'};
const picker={launchImageLibraryAsync:async options=>{calls.push(options);return launch(options);},requestMediaLibraryPermissionsAsync:async()=>{permissionCalls++;return{granted:false};}};
const context={exports:{},Promise,Error,String,require:name=>name==='react-native'?{Platform:platform,Alert:{alert:(...args)=>alerts.push(args)}}:picker};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/mediaLibraryPicker.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,context);
const choose=context.exports.chooseLibraryMedia;
const asset={uri:'file:///synthetic.jpg',mimeType:'image/jpeg',fileSize:123};
(async()=>{
 launch=async()=>({canceled:false,assets:[asset]});const options={mediaTypes:['images'],allowsMultipleSelection:true,selectionLimit:3,quality:.8};
 assert.equal((await choose(options)).assets[0],asset);assert.equal(permissionCalls,0,'denied broad library permission must not prevent selection');assert.equal(calls[0],options);
 calls=[];launch=async()=>({canceled:true,assets:null});await choose(options);assert.equal(calls.length,1,'cancel never opens another picker');
 calls=[];launch=async options=>{if(!options.legacy)throw Object.assign(Error('No activity'),{code:'ERR_MISSING_ACTIVITY_TO_HANDLE_INTENT'});return{canceled:false,assets:[asset]};};
 await choose({...options,allowsEditing:true});assert.equal(calls.length,2);assert.equal(calls[1].legacy,true);assert.equal(calls[1].allowsEditing,false);assert.equal(calls[1].selectionLimit,3);
 for(const os of ['android','ios']){platform.OS=os;calls=[];launch=async()=>{throw Error('File could not be read');};assert.equal((await choose(options)).canceled,true);assert.equal(calls.length,1,'unrelated errors do not reopen the library');}
 platform.OS='ios';calls=[];launch=async()=>{throw Object.assign(Error('No activity'),{code:'ERR_MISSING_ACTIVITY_TO_HANDLE_INTENT'});};await choose(options);assert.equal(calls.length,1,'Android fallback never runs on iOS');
 platform.OS='android';let finish;calls=[];launch=()=>new Promise(resolve=>finish=resolve);const first=choose(options);assert.equal((await choose(options)).canceled,true);assert.equal(calls.length,1,'one native picker across screens');finish({canceled:false,assets:[asset]});await first;
 launch=async()=>({canceled:false,assets:[asset]});await choose({mediaTypes:['videos']});assert.equal(calls.at(-1).mediaTypes[0],'videos');
 for(const file of ['App.tsx','components/CommunityUpdates.tsx','components/NativeProviderCatalog.tsx','components/NativeProviderProfile.tsx','components/ProviderConversation.tsx','components/Screens.tsx','components/ProviderWorkspace.tsx']){
  const source=fs.readFileSync(file,'utf8');assert.ok(source.includes('chooseLibraryMedia('),file);assert.ok(!source.includes('requestMediaLibraryPermissionsAsync'),file+' must not gate gallery access');
 }
 assert.ok(fs.readFileSync('components/ProviderWorkspace.tsx','utf8').includes('requestCameraPermissionsAsync'),'camera permissions remain required');
 console.log('Gallery policy passed: denied broad access, cancellation, Android missing-picker fallback, original selection limits, one picker, errors, iOS isolation, all seven upload entry points and camera protection.');
})().catch(error=>{console.error(error);process.exitCode=1;});
