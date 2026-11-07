const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const exportsObject={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/providerVideoProcessing.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports:exportsObject,setTimeout});
(async()=>{
 const wait=exportsObject.waitForProviderVideo,key='private/video-pending/owner/test.mp4';let reads=0,sleeps=0;
 const ready=await wait({status:'queued'},key,async path=>{reads++;assert.equal(path,'/providers/me/videos/status?key='+encodeURIComponent(key));return reads===2?{status:'complete',url:'https://api.test/video'}:{status:'processing'};},()=>true,async()=>{sleeps++});assert.equal(ready.url,'https://api.test/video');assert.equal(reads,2);assert.equal(sleeps,2);
 reads=0;await wait({url:'https://api.test/already-ready'},key,async()=>{reads++;});assert.equal(reads,0);
 await assert.rejects(wait({status:'queued'},key,async()=>{reads++;},()=>false),/processing continues/);assert.equal(reads,0);
 await assert.rejects(wait({status:'failed'},key,async()=>({})),/could not be processed/);
 reads=0;await assert.rejects(wait({status:'queued'},key,async()=>{reads++;return {status:'queued'};},()=>true,async()=>{}),/still processing/);assert.equal(reads,60);
 console.log('Video processing client PASS: GET-only recovery, bounded wait, cancellation and legacy completion');
})().catch(e=>{console.error(e);process.exitCode=1});
