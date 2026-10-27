import React,{useEffect,useRef,useState} from 'react';
import {AccessibilityInfo,ActivityIndicator,AppState,Pressable,ScrollView,View,useWindowDimensions} from 'react-native';
import {ThemedText as Text} from './ThemeProvider';
import {useAccountDesign} from './AccountDesign';
import {ResilientImage} from './ResilientImage';
import {useCatalogFreshness} from './catalogFreshness';
import {cachedDiscoveryFeed,discoveryFeed,DiscoveryCard,recordDiscovery,rememberDiscoveryTopics} from './discoveryClient';

// Continuous half-card viewability, measured in window coordinates, also works
// when this horizontal rail sits below a vertically scrolling detail screen.
export function discoveryViewable(x:number,y:number,width:number,height:number,screenWidth:number,screenHeight:number) {
 const area=width*height;if(!Number.isFinite(area)||area<=0)return false;
 const visible=Math.max(0,Math.min(x+width,screenWidth)-Math.max(x,0))*Math.max(0,Math.min(y+height,screenHeight)-Math.max(y,0));
 return visible/area>=.5;
}
function Rail({title,cards,active,onOpen,compact=false}:{title:string;cards:DiscoveryCard[];active:boolean;onOpen:(card:DiscoveryCard)=>void;compact?:boolean}) {
 const c=useAccountDesign(),screen=useWindowDimensions(),refs=useRef(new Map<string,View>()),entered=useRef(new Map<string,number>()),measuring=useRef(new Set<string>());
 const tileWidth=Math.round(Math.max(88,Math.min(112,(screen.width-48)/3))),bannerHeight=Math.round(tileWidth*.56),stride=tileWidth+12;
 const row=useRef<View|null>(null),scroll=useRef<ScrollView|null>(null),viewport=useRef({width:screen.width,content:0,x:0}),interaction=useRef({touching:false,until:0});
 const [paused,setPaused]=useState(false),[dot,setDot]=useState(0);
 const dotCount=Math.min(7,cards.length);
 const touchEnd=()=>{interaction.current={touching:false,until:Date.now()+6000};};
 useEffect(()=>{
  if(!active){entered.current.clear();return;}
  let alive=true;const measure=()=>{if(AppState.currentState!=='active'){entered.current.clear();return;}for(const card of cards){const key=card.kind+card.id,node=refs.current.get(key);if(!node||measuring.current.has(key))continue;measuring.current.add(key);node.measureInWindow((x,y,w,h)=>{measuring.current.delete(key);if(!alive||AppState.currentState!=='active')return;if(!discoveryViewable(x,y,w,h,screen.width,screen.height)){entered.current.delete(key);return;}const since=entered.current.get(key)||Date.now();entered.current.set(key,since);if(Date.now()-since>=1000)recordDiscovery(card,'impression',Date.now()-since);});}};
  const timer=setInterval(measure,500),subscription=AppState.addEventListener('change',()=>entered.current.clear());measure();
  return()=>{alive=false;clearInterval(timer);subscription.remove();entered.current.clear();};
 },[active,cards,screen.width,screen.height]);
 useEffect(()=>{
  if(!compact||!active||paused||cards.length<2)return;
  let alive=true,motionAllowed=false,pending=false,preferenceChanged=false;
  // Start only after the OS preference is known; manual swipe always remains.
  void AccessibilityInfo.isReduceMotionEnabled().then(reduced=>{if(alive&&!preferenceChanged)motionAllowed=!reduced;}).catch(()=>{});
  const motion=AccessibilityInfo.addEventListener('reduceMotionChanged',reduced=>{preferenceChanged=true;motionAllowed=!reduced;});
  const timer=setInterval(()=>{
   if(!alive||pending||!motionAllowed||AppState.currentState!=='active'||interaction.current.touching||Date.now()<interaction.current.until||!row.current)return;
   const metrics=viewport.current,max=Math.max(0,metrics.content-metrics.width);if(max<=1)return;
   pending=true;row.current.measureInWindow((x,y,w,h)=>{
    pending=false;
    if(!alive||!motionAllowed||AppState.currentState!=='active'||interaction.current.touching||Date.now()<interaction.current.until||!discoveryViewable(x,y,w,h,screen.width,screen.height))return;
    const page=Math.max(1,Math.floor((metrics.width-24)/stride))*stride;
    const wrap=metrics.x>=max-1,next=wrap?0:Math.min(max,metrics.x+page);
    scroll.current?.scrollTo({x:next,animated:!wrap});
   });
  },6000);
  return()=>{alive=false;clearInterval(timer);motion.remove();};
 },[compact,active,paused,cards,stride,screen.width,screen.height]);
 if(!cards.length)return null;
 return <View ref={row} collapsable={false} style={{paddingVertical:compact?8:12,gap:8}}>
  <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:12}}><Text style={{fontSize:compact?15:18,fontWeight:'700',flex:1}}>{title}</Text>{compact&&cards.length>1&&<Pressable accessibilityRole="button" accessibilityLabel={paused?'Resume promoted rotation':'Pause promoted rotation'} onPress={()=>setPaused(value=>!value)} style={{padding:8,minHeight:44}}><Text style={{fontSize:12,color:c.accent}}>{paused?'Play':'Pause'}</Text></Pressable>}</View>
  <ScrollView ref={scroll} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal:12,gap:12}} snapToInterval={compact?stride:undefined} decelerationRate={compact?'fast':'normal'} scrollEventThrottle={100} onLayout={event=>{viewport.current.width=event.nativeEvent.layout.width;}} onContentSizeChange={width=>{viewport.current.content=width;}} onScroll={event=>{const x=event.nativeEvent.contentOffset.x;viewport.current.x=x;const max=viewport.current.content-viewport.current.width;setDot(max>0?Math.max(0,Math.min(dotCount-1,Math.round(x/max*(dotCount-1)))):0);}} onTouchStart={()=>{interaction.current.touching=true;}} onTouchEnd={touchEnd} onTouchCancel={touchEnd} onScrollBeginDrag={()=>{interaction.current.touching=true;}} onScrollEndDrag={touchEnd}>
   {cards.map(card=><View key={card.kind+card.id} ref={node=>{if(node)refs.current.set(card.kind+card.id,node);else refs.current.delete(card.kind+card.id);}} collapsable={false} style={{width:compact?tileWidth:180,borderWidth:compact?0:1,borderColor:c.line,borderRadius:14,overflow:'hidden',backgroundColor:compact?'transparent':c.surface}}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${compact?'Promoted: ':''}${card.title}`} onPress={()=>onOpen(card)}>
     <View style={compact?{width:tileWidth,height:bannerHeight}:undefined}><ResilientImage uri={card.image_urls[0]||''} style={{height:compact?bannerHeight:140,width:compact?tileWidth:180,borderRadius:compact?10:0}} resizeMode="cover"/>{compact&&<Text style={{position:'absolute',right:4,bottom:4,fontSize:9,fontWeight:'700',color:c.text,backgroundColor:c.soft,paddingHorizontal:4,borderRadius:4}}>Ad</Text>}</View>
     <View style={{padding:compact?2:10,gap:4}}><Text numberOfLines={2} style={{fontWeight:'600',fontSize:compact?11:14,minHeight:compact?30:36,textAlign:compact?'center':'left'}}>{card.title}</Text>{!compact&&<Text numberOfLines={1} style={{fontSize:12,color:c.muted}}>{card.kind==='product'?'Product':'Service'}{card.city?' - '+card.city:''}</Text>}<Text numberOfLines={1} adjustsFontSizeToFit style={{fontWeight:'700',fontSize:compact?11:14,color:c.accent,textAlign:compact?'center':'left'}}>{card.price===null?'Ask for a price':`${card.price_mode==='from'?'From ':''}${card.currency} ${Number(card.price).toLocaleString('en-NG')}`}</Text>{card.price!==null&&Number(card.compare_at_price)>Number(card.price)&&<Text numberOfLines={1} adjustsFontSizeToFit style={{fontSize:11,color:'#C62828',textDecorationLine:'line-through',textAlign:compact?'center':'left'}}>{card.currency} {Number(card.compare_at_price).toLocaleString('en-NG')}</Text>}</View>
    </Pressable>
   </View>)}
  </ScrollView>
  {compact&&cards.length>1&&<View accessible accessibilityLabel="Promoted carousel position" style={{flexDirection:'row',justifyContent:'center',alignItems:'center',gap:5,paddingVertical:2}}>{Array.from({length:dotCount},(_,i)=><View key={i} style={{width:i===dot?18:5,height:5,borderRadius:3,backgroundColor:i===dot?c.accent:c.line}}/>)}</View>}
 </View>;

}
export function DiscoverySections({owner,country='NG',state='',city='',search='',kind,sourceKind,sourceID,topics=[],active=true,onOpen}:{owner:string|null;country?:string;state?:string;city?:string;search?:string;kind?:'product'|'service';sourceKind?:'product'|'service';sourceID?:string;topics?:string[];active?:boolean;onOpen:(card:DiscoveryCard)=>void}) {
 const listingKind=sourceID?sourceKind:kind, noun=listingKind==='product'?'Products':listingKind==='service'?'Services':'Listings';
 const c=useAccountDesign(),[data,setData]=useState<{similar:DiscoveryCard[];recommended:DiscoveryCard[];promoted:DiscoveryCard[]}|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0),sequence=useRef(0),topicsRef=useRef(topics);topicsRef.current=topics;
 useCatalogFreshness(()=>setRetry(n=>n+1),active);
 useEffect(()=>{
  const version=++sequence.current;if(!active)return;
  let alive=true;const context={owner,country,state,city,search,kind,sourceKind,sourceID};
  if(sourceID)rememberDiscoveryTopics(owner,topicsRef.current);
  setData(cachedDiscoveryFeed(context));setError('');
  const load=(force=false)=>{if(AppState.currentState!=='active')return;void discoveryFeed(context,force).then(next=>{if(alive&&version===sequence.current){setData(next);setError('');}}).catch(()=>{if(alive&&version===sequence.current)setError('Could not refresh discovery. Tap to retry.');});};
  const delay=setTimeout(()=>load(retry>0),300),timer=setInterval(()=>load(),60000);
  const foreground=AppState.addEventListener('change',state=>{if(state==='active')load();});
  return()=>{alive=false;clearTimeout(delay);clearInterval(timer);foreground.remove();};
 },[owner,country,state,city,search,kind,sourceKind,sourceID,active,retry]);
 if(!active)return null;
 const cards=data?(sourceID?data.similar:data.promoted):[];
 return <View>{!data&&!error&&<ActivityIndicator accessibilityLabel="Loading listing discovery" style={{padding:12}}/>}{!!error&&<Pressable accessibilityRole="button" onPress={()=>setRetry(n=>n+1)}><Text style={{color:c.danger,padding:12}}>{error}</Text></Pressable>}{data&&<Rail title={sourceID?`Recommended ${noun}`:`Promoted ${noun}`} cards={cards} compact={!sourceID} active={active} onOpen={onOpen}/>}</View>;
}
