const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const source=fs.readFileSync('components/customerEntryConfig.ts','utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
async function run(){
 let requests=0,now=100000,reply={response:{ok:true},body:{sponsored_entry_enabled:false}};
 const context={exports:{},require:()=>({fetchJSONWithTimeout:async()=>{requests++;if(reply instanceof Error)throw reply;return reply;}}),Date:{now:()=>now},Promise};
 vm.runInNewContext(compiled,context);
 const enabled=context.exports.customerEntryEnabled;
 assert.equal(await enabled(),false);assert.equal(await enabled(),false);assert.equal(requests,1,'config is cached for one minute');
 now+=60001;reply={response:{ok:true},body:{sponsored_entry_enabled:true}};assert.equal(await enabled(),true);assert.equal(requests,2);
 now+=60001;reply=new Error('offline');assert.equal(await enabled(),true,'network errors preserve access');
 console.log('Customer entry config passed: on/off, one-minute cache and offline fallback.');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
