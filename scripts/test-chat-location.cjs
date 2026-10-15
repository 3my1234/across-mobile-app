const assert=require('node:assert/strict'),fs=require('fs'),ts=require('typescript'),vm=require('vm');
const context={exports:{},Number};vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/chatLocation.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,context);
const {validLocation,locationMapURL}=context.exports;
for(const pin of [{latitude:91,longitude:0},{latitude:9,longitude:Infinity},{latitude:'9',longitude:7},null])assert.equal(validLocation(pin),false);
assert.equal(locationMapURL({latitude:9.08,longitude:7.45}),'https://www.google.com/maps/search/?api=1&query=9.08,7.45');
assert.equal(locationMapURL({latitude:NaN,longitude:7}), '');
console.log('Chat location checks passed: bounded numeric coordinates and generated static map links.');
