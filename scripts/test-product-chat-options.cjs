/* global __dirname */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const read=name=>fs.readFileSync(path.join(__dirname,'../components',name),'utf8');
function run(code,globals){const ctx=vm.createContext(globals);vm.runInContext(ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,ctx);return ctx;}
async function main(){
 const pending=[];let messages=[],uploads=[];
 const helpers=run(read('chatImages.ts').replace(/^import [^\r\n]*\r?\n/gm,'').replace(/export /g,''),{API_URL:'https://example.test',Date,Map,Array,AbortController,setTimeout,clearTimeout,
  fetch:async(url,options)=>{uploads.push({url,options});return options?{ok:true}:{blob:async()=>({size:100})};},
  fetchJSONWithTimeout:async(url,options)=>{uploads.push({url,options});return {response:{ok:true},body:{upload_url:'https://storage.test/signed',key:'private/image'}};}});
 const uploaded=await helpers.uploadChatImage('buyer',{uri:'file://photo',mimeType:'image/png',fileName:'screenshot.png'});
 assert.equal(uploaded.key,'private/image');assert.equal(uploads[1].options.headers.Authorization,'Bearer buyer');assert.equal(uploads[2].options.headers.Authorization,undefined);assert.equal(uploads[2].options.headers['Content-Type'],'image/png');
 await assert.rejects(helpers.uploadChatImage('buyer',{uri:'file://large',fileSize:6*1024*1024}),/5 MB/);
 await assert.rejects(helpers.uploadChatImage('buyer',{uri:'file://bad',mimeType:'application/pdf'}),/JPG/);
 const stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d+Z$/,'Z');
 const photo=`https://storage.test/photo?X-Amz-Date=${stamp}&X-Amz-Expires=900&X-Amz-Signature=old`;
 const old={id:'photo',created_at:'2026-10-08T10:00:00Z',media_urls:[photo]};
 const merged=helpers.mergeChatMessages([old],[{...old,media_urls:[photo.replace('old','new')]}]);assert.equal(merged[0].media_urls[0],photo,'polling must not reload valid photos');
 const expired={...old,media_urls:[photo.replace(stamp,'20260101T000000Z')]};assert.equal(helpers.mergeChatMessages([expired],[old])[0].media_urls[0],photo,'expired private URLs must refresh');
 const mapping=read('utils.ts');const mapContext=run(mapping.slice(mapping.indexOf('export function mapProduct'),mapping.indexOf('\nexport ',mapping.indexOf('export function mapProduct')+1)).replace('export function','function'),{normalizeMediaUrls:urls=>urls,Number});
 assert.equal(mapContext.mapProduct({id:'p',factory_details:{payment_mode:'contact'}}).payment_mode,'contact');assert.equal(mapContext.mapProduct({id:'p'}).payment_mode,'flutterwave');
 const cart=run(read('catalogState.ts').replace(/^import [^\r\n]*\r?\n/gm,'').replace(/export /g,''),{Map,Set,Date});const product={id:'p',inventory_count:2,payment_mode:'flutterwave'};
 assert.equal(cart.reconcileCart([{product,quantity:1}],new Map([['p',{...product,payment_mode:'contact'}]]),new Set()).length,0);
 const g={product:{id:'watch'},headers:{Authorization:'Bearer buyer'},API_URL:'https://example.test',alive:{current:true},conversation:{current:''},sending:{current:false},setBusy:()=>{},setError:()=>{},merge:incoming=>{messages=helpers.mergeChatMessages(messages,incoming);},fetchJSONWithTimeout:(url,options)=>new Promise(resolve=>pending.push({url,options,resolve}))};
 const source=read('ProductSellerChat.tsx');const send=run(source.slice(source.indexOf(' async function send'),source.indexOf(' return <ProviderConversation')),g);
 const first=send.send('', ['private/image'],'client-id');assert.match(pending[0].url,/products\/watch\/conversations$/);assert.equal(JSON.parse(pending[0].options.body).media_keys[0],'private/image');
 pending.shift().resolve({response:{ok:true},body:{id:'thread',message_id:'first',body:'Photo',created_at:'2026-10-08T10:00:00Z',media_urls:[photo]}});await first;assert.equal(messages[0].id,'first');assert.equal(pending.length,0,'send acknowledgement must not wait for a history refresh');
 const next=send.send('Thanks',[],'next-id');assert.match(pending[0].url,/conversations\/thread\/messages$/);pending.shift().resolve({response:{ok:true},body:{id:'reply',body:'Thanks',created_at:'2026-10-08T10:01:00Z'}});await next;assert.equal(messages.length,2);
 const late=send.send('Old account');g.alive.current=false;pending.shift().resolve({response:{ok:true},body:{id:'private-old',created_at:'2026-10-08T10:02:00Z'}});await late;assert.equal(messages.length,2,'unmounted account must ignore private response');
 // The shared service/product composer retains its message reference and
 // attachments after a lost response, so retrying cannot duplicate the send.
 let attempt=0,reference=0,cleared=false;const references=[];
 const composerGlobals={draft:'',photos:[{key:'private/image'}],uploading:false,props:{busy:false,paused:false,onSend:async(text,keys,id)=>{references.push(id);if(++attempt===1)throw new Error('timeout');assert.equal(text,'');assert.equal(keys[0],'private/image');}},sending:{current:false},messageReference:{current:{fingerprint:'',id:''}},Crypto:{randomUUID:()=>`message-${++reference}`},mounted:{current:true},setDraft:()=>{cleared=true;},setPhotos:()=>{},nearBottom:{current:false}};
 const composer=read('ProviderConversation.tsx');const c=run(composer.slice(composer.indexOf('  const send = async'),composer.indexOf('  return <KeyboardAvoidingView')),composerGlobals);vm.runInContext('globalThis.sendMessage=send',c);
 await assert.rejects(c.sendMessage(),/timeout/);assert.equal(cleared,false);await c.sendMessage();assert.equal(references[0],references[1]);assert.equal(cleared,true);
 console.log('Product chat/options passed: image uploads, private URL reuse/expiry, mode mapping, cart exclusion, new/existing photo sends, acknowledgement, account isolation and idempotent retries.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
