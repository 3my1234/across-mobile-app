const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),ts=require("typescript");
const compile=name=>ts.transpileModule(fs.readFileSync(`components/${name}.ts`,"utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
function load(name){const context={exports:{},Date};vm.createContext(context);vm.runInContext(compile(name),context);return context.exports;}
const {createChatHistoryCache}=load("chatHistoryCache"),cache=createChatHistoryCache(2,300000,2);
cache.get("buyer","a");cache.put("buyer","a",[{id:"one"}],"cursor");assert.equal(cache.get("buyer","a").messages[0].id,"one");
cache.put("buyer","b",[{id:"two"}],"");cache.put("buyer","c",[{id:"three"}],"");assert.equal(cache.get("buyer","a"),null);
cache.get("other","a");cache.put("buyer","a",[{id:"private"}],"");assert.equal(cache.get("other","a"),null,"late old-account response cannot overwrite new cache");
cache.put("other","a",[1,2,3],"");assert.equal(cache.get("other","a"),null,"oversized history is not cached with an invalid earlier cursor");
const {clampPhotoTransform,zoomPhotoAt}=load("photoZoom"),view={width:300,height:600},image={width:600,height:600};
const fit=clampPhotoTransform({scale:1,x:99,y:99},view,image);assert.equal(fit.x,0);assert.equal(fit.y,0);
const pinch=zoomPhotoAt({scale:1,x:0,y:0},2,{x:50,y:0});assert.equal(pinch.x,-50,"pinch keeps the focal image point under the fingers");
const dragged=clampPhotoTransform({scale:10,x:9999,y:-9999},view,image);assert.equal(dragged.scale,5);assert.equal(dragged.x,600);assert.equal(dragged.y,-450);
const expired=createChatHistoryCache(2,-1);expired.get("buyer","a");expired.put("buyer","a",[1],"");assert.equal(expired.get("buyer","a"),null);
console.log("Chat viewer/history passed: focal zoom, pan bounds, capacity/expiry, account isolation and stale responses.");
const utils=fs.readFileSync('components/utils.ts','utf8'),context={exports:{},AbortController,Promise,setTimeout,clearTimeout,fetch:async()=>({status:304,json:()=>{throw Error('304 has no JSON body')}})};
vm.createContext(context);vm.runInContext(ts.transpileModule(utils.slice(utils.indexOf('export async function fetchJSONWithTimeout'),utils.indexOf('// Only history reads')), {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,context);
context.exports.fetchJSONWithTimeout('https://fixture.test').then(result=>{assert.equal(result.response.status,304);assert.deepEqual(Object.keys(result.body),[]);console.log('Conditional polling passed: 304 preserves history without decoding an empty JSON body.');}).catch(error=>{console.error(error);process.exitCode=1;});
