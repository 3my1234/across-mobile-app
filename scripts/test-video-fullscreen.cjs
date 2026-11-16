const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const cells=[],effects=[];let index=0,pending=[],created=0,released=0,plays=0;
const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
const player={currentTime:27,status:'readyToPlay',muted:false,play(){plays++;},addListener(){return{remove(){}};}};
const react={createElement:(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity)}),useState(initial){const i=index++;if(!(i in cells))cells[i]=initial;return[cells[i],value=>cells[i]=typeof value==='function'?value(cells[i]):value];},useEffect(fn,deps){const i=index++;if(!same(effects[i]?.deps,deps)){const previous=effects[i];effects[i]={deps};pending.push(()=>{previous?.cleanup?.();effects[i].cleanup=fn();});}}};
const deps={'react':react,'react-native':{View:'View',Pressable:'Button',Modal:'Modal',ActivityIndicator:'Spinner',StyleSheet:{absoluteFill:{},create:x=>x}},'react-native-safe-area-context':{SafeAreaProvider:'Insets',SafeAreaView:'SafeArea'},'./ThemeProvider':{ThemedText:'Text'},'./listingVideoCache':{videoBufferOptions:{}},'expo-video':{VideoView:'Video',useVideoPlayer(source,setup){const i=index++;if(!(i in cells)){cells[i]=player;created++;setup(player);}react.useEffect(()=>()=>released++,[]);return cells[i];}}};
const context={exports:{},require:name=>{assert.ok(name in deps,name);return deps[name];}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/CachedListingVideo.tsx','utf8')+'\nexports.TestPlayer=Player;',{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText,context);
const nodes=n=>!n||typeof n!=='object'?[]:[n,...(n.children||[]).flatMap(nodes)];
let tree;const draw=()=>{index=0;pending=[];tree=context.exports.TestPlayer({uri:'https://media.test/clip.mp4',cached:true,muted:false});pending.forEach(fn=>fn());return tree;};
const button=label=>{const node=nodes(tree).find(n=>n.type==='Button'&&n.props.accessibilityLabel===label);assert.ok(node,label);return node;};
draw();assert.equal(player.muted,false);assert.equal(plays,1);
button('Mute video').props.onPress();draw();assert.equal(player.muted,true);
for(let i=0;i<3;i++){
 button('Expand video').props.onPress();draw();
 assert.equal(nodes(tree).filter(n=>n.type==='Video').length,1,'never attach two video surfaces to one Android player');
 const video=nodes(tree).find(n=>n.type==='Video');assert.equal(video.props.player,player);assert.equal(video.props.fullscreenOptions.enable,false,'no native Activity handoff');
 assert.equal(nodes(tree).find(n=>n.type==='Modal').props.presentationStyle,'fullScreen');
 assert.ok(nodes(tree).find(n=>n.type==='SafeArea').props.edges.includes('bottom'),'controls stay outside device navigation');
 assert.equal(player.currentTime,27);assert.equal(player.muted,true,'user mute choice survives expansion');assert.equal(released,0);
 if(i===1)nodes(tree).find(n=>n.type==='Modal').props.onRequestClose();else button('Exit fullscreen').props.onPress();draw();
 assert.ok(!nodes(tree).some(n=>n.type==='Modal'));assert.equal(nodes(tree).filter(n=>n.type==='Video').length,1);assert.equal(player.currentTime,27);assert.equal(released,0);
}
button('Unmute video').props.onPress();draw();assert.equal(player.muted,false);assert.equal(created,1);assert.equal(plays,1,'expanding does not restart playback');
effects.forEach(e=>e?.cleanup?.());assert.equal(released,1);
console.log('Video fullscreen lifecycle passed: audible default, mute, single retained player/surface, repeated expand/shrink and Android Back, playback position and bottom safe area. Phone acceptance remains required.');
