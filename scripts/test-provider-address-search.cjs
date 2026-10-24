const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
let granted=true,lookups=0,timeout=false,cleared=0,results=[];
const context={exports:{},Error,Number,Promise,setTimeout:(fn,ms)=>{assert.equal(ms,12000);if(timeout)queueMicrotask(fn);return 1;},clearTimeout:()=>cleared++,require:name=>{
 if(name!=='expo-location')throw Error('Unexpected dependency');
 return {requestForegroundPermissionsAsync:async()=>({granted}),geocodeAsync:async()=>{lookups++;if(timeout)return new Promise(()=>{});return results;}};
}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/providerAddressSearch.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,context);
const search=context.exports.providerAddressSearch;
(async()=>{
 await assert.rejects(search(' '),/complete address/);assert.equal(lookups,0);
 granted=false;await assert.rejects(search('Synthetic city'),/foreground location/);assert.equal(lookups,0);
 granted=true;results=[{latitude:95,longitude:3},{latitude:6,longitude:NaN},...Array.from({length:8},()=>({latitude:6,longitude:3}))];
 const found=await search('Synthetic city');assert.equal(found.length,5);assert.equal(found[0].latitude,6);assert.equal(found[0].longitude,3);
 results=[];await assert.rejects(search('Synthetic city'),/No location matched/);
 timeout=true;await assert.rejects(search('Synthetic city'),/timed out/);assert.equal(cleared,3,'each native lookup must clear its deadline');
 console.log('Provider address search passed: explicit permission, native geocoder, bounded validated results, no-match recovery and finite timeout.');
})().catch(error=>{console.error(error);process.exitCode=1;});
