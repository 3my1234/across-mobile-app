import React,{useEffect,useRef,useState} from 'react';
import {AccessibilityInfo,ActivityIndicator,AppState,Pressable,ScrollView,View,useWindowDimensions} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {ProviderIdentity} from './ProviderIdentity';
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
 // Wide, shallow promotions leave room for the ordinary catalogue below.
 const tileWidth=Math.round(Math.max(200,screen.width-24)),stride=tileWidth+12;
 const bannerHeight=Math.ceil(16+72*Math.max(1,screen.fontScale||1));
 const imageWidth=Math.round(Math.min(126,tileWidth*.31)),imageHeight=bannerHeight-16;
 const row=useRef<View|null>(null),scroll=useRef<ScrollView|null>(null),viewport=useRef({width:screen.width,content:0,x:0}),interaction=useRef({touching:false,until:0});
 const [paused,setPaused]=useState(false),[position,setPosition]=useState({count:1,index:0});
 const updatePosition=()=>{
  const metrics=viewport.current,max=Math.max(0,metrics.content-metrics.width),page=Math.max(1,Math.floor((metrics.width-24)/stride))*stride;
  const count=max>1?Math.ceil(max/page)+1:1,index=max<=1?0:metrics.x>=max-1?count-1:Math.max(0,Math.min(count-1,Math.round(metrics.x/page)));
  setPosition(previous=>previous.count===count&&previous.index===index?previous:{count,index});
 };
 const dotCount=Math.min(7,position.count),dot=position.count>1?Math.round(position.index/(position.count-1)*(dotCount-1)):0;
 const touchEnd=()=>{interaction.current={touching:false,until:Date.now()+6000};};
 useEffect(()=>{
  if(!active||!cards.length){entered.current.clear();return;}
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
 if(!cards.length&&!compact)return null;
 return <View ref={row} collapsable={false} style={{paddingVertical:compact?8:12,gap:8,...(compact?{borderBottomWidth:1,borderBottomColor:c.accent,marginBottom:8}:{})}}>
  <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:12}}>{compact&&<Ionicons name="megaphone" size={21} color={c.accent} style={{marginRight:7}}/>}<Text style={{fontSize:compact?17:18,fontWeight:'700',flex:1}}>{title}</Text>{compact&&cards.length>1&&<Pressable accessibilityRole="button" accessibilityLabel={paused?'Resume sponsored rotation':'Pause sponsored rotation'} onPress={()=>setPaused(value=>!value)} style={{padding:8,minHeight:44,flexDirection:'row',alignItems:'center',gap:4}}><Ionicons name={paused?'play-circle-outline':'pause-circle-outline'} size={18} color={c.accent}/><Text style={{fontSize:12,color:c.accent}}>{paused?'Play':'Pause'}</Text></Pressable>}</View>
  {!cards.length&&compact&&<View style={{marginHorizontal:12,padding:12,borderRadius:12,borderWidth:1,borderColor:c.line}}><Text style={{fontSize:12,color:c.muted}}>No sponsored {title.toLowerCase().includes('product')?'products':'services'} available right now.</Text></View>}
  {!!cards.length&&<ScrollView ref={scroll} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal:12,gap:12}} snapToInterval={compact?stride:undefined} decelerationRate={compact?'fast':'normal'} scrollEventThrottle={100} onLayout={event=>{viewport.current.width=event.nativeEvent.layout.width;updatePosition();}} onContentSizeChange={width=>{viewport.current.content=width;updatePosition();}} onScroll={event=>{viewport.current.x=event.nativeEvent.contentOffset.x;updatePosition();}} onTouchStart={()=>{interaction.current.touching=true;}} onTouchEnd={touchEnd} onTouchCancel={touchEnd} onScrollBeginDrag={()=>{interaction.current.touching=true;}} onScrollEndDrag={touchEnd}>
   {cards.map((card,cardIndex)=><View key={card.kind+card.id} ref={node=>{if(node)refs.current.set(card.kind+card.id,node);else refs.current.delete(card.kind+card.id);}} collapsable={false} style={{width:compact?tileWidth:180,borderWidth:1,borderColor:compact?c.accent:c.line,borderRadius:14,overflow:'hidden',backgroundColor:c.surface}}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${compact?'Promoted: ':''}${card.title}`} onPress={()=>onOpen(card)}>
     {compact?<View style={{width:tileWidth-2,height:bannerHeight,borderRadius:14,overflow:'hidden',backgroundColor:c.surface,flexDirection:'row',padding:8,gap:10}}>
      <ResilientImage uri={card.image_urls[0]||''} style={{height:imageHeight,width:imageWidth,borderRadius:10}} priority={cardIndex===position.index?"high":"low"} resizeMode="cover"/>
      <View style={{flex:1,minWidth:0,justifyContent:'space-between',paddingVertical:1}}>
       <View style={{flexDirection:'row',alignItems:'center',gap:5,minWidth:0}}>
        <Text style={{fontSize:10,lineHeight:14,fontWeight:'800',color:c.dark?'#08261D':'#FFFFFF',backgroundColor:c.accent,paddingHorizontal:5,paddingVertical:2,borderRadius:5}}>Sponsored</Text>
        {card.provider_identity?.name&&<View style={{flex:1,minWidth:0,borderLeftWidth:1,borderLeftColor:c.accent,paddingLeft:5}}><ProviderIdentity identity={card.provider_identity} compact dense/></View>}
        {!card.provider_identity?.name&&!!card.provider_name&&<Text numberOfLines={1} style={{fontSize:10,flex:1,color:c.muted}}>{card.provider_name}</Text>}
       </View>
       <Text numberOfLines={1} style={{fontSize:14,lineHeight:17,fontWeight:'700',color:c.text}}>{card.title}</Text>
       <View style={{flexDirection:'row',alignItems:'center',gap:3,minWidth:0}}>
        {!!card.city&&<Ionicons name="location-outline" size={12} color={c.muted}/>}
        <Text numberOfLines={1} adjustsFontSizeToFit style={{fontSize:11,lineHeight:15,color:c.text,flexShrink:1}}>{card.city?card.city+' \u00b7 ':''}{card.price===null||card.price_mode==='quote'?'Ask for a quote':`${card.price_mode==='from'?'From ':''}${card.currency} ${Number(card.price).toLocaleString('en-NG')}`}{card.price!==null&&Number(card.compare_at_price)>Number(card.price)&&<Text style={{fontSize:10,color:c.muted,textDecorationLine:'line-through'}}> {card.currency} {Number(card.compare_at_price).toLocaleString('en-NG')}</Text>}</Text>
       </View>
       <Text style={{fontSize:12,lineHeight:16,fontWeight:'700',textDecorationLine:'underline',color:c.accent}}>View {card.kind==='product'?'product':'service'} {'\u2192'}</Text>
      </View>
     </View>:<>
      <ResilientImage uri={card.image_urls[0]||''} style={{height:140,width:180}} resizeMode="cover"/>
      <View style={{padding:10,gap:4}}><Text numberOfLines={2} style={{fontWeight:'600',fontSize:14,minHeight:36}}>{card.title}</Text><Text numberOfLines={1} style={{fontSize:12,color:c.muted}}>{card.kind==='product'?'Product':'Service'}{card.city?' - '+card.city:''}</Text><Text numberOfLines={1} adjustsFontSizeToFit style={{fontWeight:'700',fontSize:14,color:c.accent}}>{card.price===null?'Ask for a price':`${card.price_mode==='from'?'From ':''}${card.currency} ${Number(card.price).toLocaleString('en-NG')}`}</Text>{card.price!==null&&Number(card.compare_at_price)>Number(card.price)&&<Text numberOfLines={1} adjustsFontSizeToFit style={{fontSize:11,color:'#C62828',textDecorationLine:'line-through'}}>{card.currency} {Number(card.compare_at_price).toLocaleString('en-NG')}</Text>}</View>
     </>}
    </Pressable>
   </View>)}
  </ScrollView>}
  {compact&&position.count>1&&<View accessible accessibilityLabel={`Sponsored carousel, page ${position.index+1} of ${position.count}`} style={{flexDirection:'row',justifyContent:'center',alignItems:'center',gap:5,paddingVertical:2}}>{Array.from({length:dotCount},(_,i)=><View key={i} style={{width:i===dot?18:5,height:5,borderRadius:3,backgroundColor:i===dot?c.accent:c.line}}/>)}</View>}
 </View>;

}
export function DiscoverySections({owner,country='NG',state='',city='',search='',kind,sourceKind,sourceID,topics=[],active=true,onOpen}:{owner:string|null;country?:string;state?:string;city?:string;search?:string;kind?:'product'|'service';sourceKind?:'product'|'service';sourceID?:string;topics?:string[];active?:boolean;onOpen:(card:DiscoveryCard)=>void}) {
 const listingKind=sourceID?sourceKind:kind, noun=listingKind==='product'?'Products':listingKind==='service'?'Services':'Listings';
 const c=useAccountDesign(),[data,setData]=useState<{similar:DiscoveryCard[];recommended:DiscoveryCard[];promoted:DiscoveryCard[]}|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0),sequence=useRef(0),dataContext=useRef(''),topicsRef=useRef(topics);topicsRef.current=topics;
 useCatalogFreshness(()=>setRetry(n=>n+1),active);
 useEffect(()=>{
  const version=++sequence.current;if(!active)return;
  let alive=true;const context={owner,country,state,city,search,kind,sourceKind,sourceID};
  if(sourceID)rememberDiscoveryTopics(owner,topicsRef.current);
  const key=JSON.stringify(context),sameContext=dataContext.current===key;dataContext.current=key;
  const cached=cachedDiscoveryFeed(context);setData(previous=>cached||(sameContext?previous:null));setError('');
  const load=(force=false)=>{if(AppState.currentState!=='active')return;void discoveryFeed(context,force).then(next=>{if(alive&&version===sequence.current){setData(next);setError('');}}).catch(()=>{if(alive&&version===sequence.current)setError('Could not refresh discovery. Tap to retry.');});};
  const delay=setTimeout(()=>load(retry>0),300),timer=setInterval(()=>load(),60000);
  const foreground=AppState.addEventListener('change',state=>{if(state==='active')load();});
  return()=>{alive=false;clearTimeout(delay);clearInterval(timer);foreground.remove();};
 },[owner,country,state,city,search,kind,sourceKind,sourceID,active,retry]);
 const cards=data?(sourceID?data.similar:data.promoted):[];
 return <View>{!data&&!error&&<ActivityIndicator accessibilityLabel="Loading listing discovery" style={{padding:12}}/>}{!!error&&<Pressable accessibilityRole="button" onPress={()=>setRetry(n=>n+1)}><Text style={{color:c.danger,padding:12}}>{error}</Text></Pressable>}{data&&<Rail title={sourceID?`Recommended ${noun}`:`Sponsored ${noun.toLowerCase()}`} cards={cards} compact={!sourceID} active={active} onOpen={onOpen}/>}</View>;
}
