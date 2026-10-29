const fs=require('fs'),vm=require('vm'),ts=require('typescript'),assert=require('node:assert/strict');
let hooks=[],index=0,effects=[],timers=new Map(),nextTimer=0,changed=false,appState;
const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
const react={createElement:(type,props)=>({type,props}),useRef:initial=>{const i=index++;return hooks[i]||(hooks[i]={current:initial});},useState:initial=>{const i=index++;if(!(i in hooks))hooks[i]=initial;return [hooks[i],value=>{hooks[i]=typeof value==='function'?value(hooks[i]):value;changed=true;}];},useMemo:(fn,deps)=>{const i=index++;if(!hooks[i]||!same(hooks[i].deps,deps))hooks[i]={value:fn(),deps};return hooks[i].value;},useEffect:(fn,deps)=>{const i=index++;if(!hooks[i]||!same(hooks[i].deps,deps)){const previous=hooks[i];hooks[i]={deps};effects.push(()=>{previous?.cleanup?.();hooks[i].cleanup=fn();});}}};
const utils={exports:{},require:()=>({API_URL:'https://api.test'})};vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/utils.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{...utils,URL});
const context={exports:{},require:name=>name==='react'?react:name==='expo-image'?{Image:'Image'}:name==='react-native'?{Image:'Image',AppState:{addEventListener:(_name,fn)=>{appState=fn;return {remove(){appState=null;}};}}}:name==='./config'?{API_URL:'https://api.test',FALLBACK_IMAGES:['https://fallback.test/photo.png']}:utils.exports,setTimeout:(fn,delay)=>{const id=++nextTimer;timers.set(id,{fn,delay});return id;},clearTimeout:id=>timers.delete(id)};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/ResilientImage.tsx','utf8'),{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,context);
const original='https://api.test/api/v1/public/images/view/photo.jpg';let props={uri:original};
function render(){let node;for(let count=0;count<6;count++){index=0;effects=[];changed=false;node=context.exports.ResilientImage(props);effects.forEach(fn=>fn());if(!changed)return node;}throw Error('render loop');}
function retryTimer(){const entry=[...timers].find(([,t])=>t.delay<20000);assert.ok(entry,'bounded retry scheduled');timers.delete(entry[0]);entry[1].fn();return render();}
let image=render();const old=image;assert.equal(image.props.cachePolicy,'memory-disk');assert.equal(image.props.source.cacheKey,original);assert.equal(image.props.key,undefined,'do not remount native image on retries');image.props.onError({});image=retryTimer();assert.ok(image.props.source.uri.startsWith(original),'retry original before fallback');image.props.onError({});image=retryTimer();assert.ok(image.props.source.uri.startsWith(original));image.props.onError({});image=retryTimer();assert.ok(image.props.source.uri.includes('fallback'));image.props.onLoad({});const recovery=[...timers].find(([,timer])=>timer.delay===30000);assert.ok(recovery,'recover fallback without leaving the page');timers.delete(recovery[0]);recovery[1].fn();image=render();assert.equal(image.props.source.cacheKey,original,'retry uses stable disk cache identity');appState('active');image=render();assert.ok(image.props.source.uri.startsWith(original),'resume recovers original even if fallback loaded');old.props.onError({});assert.ok(![...timers.values()].some(t=>t.delay<20000),'late original callback ignored');image.props.onLoad({});const loadedKey=image.props.source.cacheKey;image=render();assert.equal(image.props.source.cacheKey,loadedKey,'loaded photo survives parent refresh');
props={...props,uris:[original]};image=render();const before=image.props.key;props={...props,uris:[original]};image=render();assert.equal(image.props.key,before,'equal URI arrays do not restart downloads');
props={uri:'https://bucket.s3.eu-west-1.amazonaws.com/catalog/photo.jpg?X-Amz-Signature=old'};image=render();image.props.onLoad({source:{url:image.props.source.uri,width:100,height:100}});const canonical=image.props.source;
props={uri:'https://bucket.s3.eu-west-1.amazonaws.com/catalog/photo.jpg?X-Amz-Signature=new'};image=render();assert.equal(image.props.source,canonical,'rotating a signed URL must not restart the loaded image');
assert.equal(utils.exports.normalizeMediaUrl(utils.exports.normalizeMediaUrl('user-uploads/a.avif')),utils.exports.normalizeMediaUrl('user-uploads/a.avif'),'portable cache URL is idempotent');
props={uri:'https://api.test/private-chat/photo?token=short-lived'};image=render();assert.equal(image.props.cachePolicy,'memory','private/signed image routes do not enter the public disk cache');
props={uri:original+'-updated'};image=render();assert.equal(image.props.source.cacheKey,original+'-updated','provider image replacement selects a new cache entry');

// Execute the real JSX maps and compare rendered child identity across a URL
// refresh and a different listing. No literal key-expression assertion.
function checkPhotoSlots(file,startMarker,multiline){
 const source=fs.readFileSync(file,'utf8'),start=source.indexOf(startMarker);assert.ok(start>=0);
 const end=multiline?source.indexOf('))}',start)+3:source.indexOf('\n',start);
 const expression=source.slice(start,end).trim().slice(1,-1);
 const scope={exports:{},React:{createElement:(type,props,...children)=>({type,props,children})},ResilientImage:'Image',Pressable:'Button',ProductPhoto:'Photo',styles:{},windowWidth:400,viewportWidth:400,showAllPhotos:true,listingIndex:0};
 const code=ts.transpileModule('exports.render=()=>('+expression+');',{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 vm.runInNewContext(code,scope);
 const draw=(id,url)=>{scope.item=scope.selected=scope.product={id,media_urls:[url]};scope.images=[url];return scope.exports.render()[0].props.key;};
 const old=draw('same-listing','https://images.test/old.jpg');assert.equal(draw('same-listing','https://images.test/new.jpg'),old,'URL update retains native image slot');assert.notEqual(draw('other-listing','https://images.test/new.jpg'),old,'different listing cannot inherit image slot');
}
checkPhotoSlots('components/MarketplaceScreen.tsx','{(selected.media_urls?.length ? selected.media_urls',true);
checkPhotoSlots('components/MarketplaceScreen.tsx','{(item.media_urls?.length ? item.media_urls.slice',false);
checkPhotoSlots('components/Screens.tsx','{images.map((uri, index)',true);
checkPhotoSlots('components/Screens.tsx','{(showAllPhotos ? images : images.slice',false);
hooks.forEach(h=>h?.cleanup?.());assert.equal(timers.size,0,'unmount clears all timers');
console.log('Image recovery passed: original retries, fallback, foreground recovery, stale callbacks, stable candidate arrays and cleanup.');
