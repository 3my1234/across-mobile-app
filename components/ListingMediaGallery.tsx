import React,{useState,useRef,useEffect} from 'react';
import {Pressable,ScrollView,View} from 'react-native';
import {ThemedText as Text} from './ThemeProvider';
import {ResilientImage} from './ResilientImage';
import {CachedListingVideo} from './CachedListingVideo';
export function ListingMediaGallery({images,videos,width,height=width,onImage,active=true}:{images:string[];videos?:string[];width:number;height?:number;onImage?:(index:number)=>void;active?:boolean}) {
 const [index,setIndex]=useState(0),[settled,setSettled]=useState(true);
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null);useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);
 const photos=images.filter(Boolean),clips=(videos||[]).filter(url=>/^https:\/\//i.test(url)).slice(0,5),total=photos.length+clips.length;
 return <View style={{height,backgroundColor:'#07110D'}}><ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onScrollBeginDrag={()=>setSettled(false)} scrollEventThrottle={32} onScroll={event=>{const x=event.nativeEvent.contentOffset.x;setSettled(false);if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>{setIndex(Math.max(0,Math.min(total-1,Math.round(x/width))));setSettled(true);},120);}} onMomentumScrollEnd={event=>{if(timer.current)clearTimeout(timer.current);setIndex(Math.max(0,Math.min(total-1,Math.round(event.nativeEvent.contentOffset.x/width))));setSettled(true);}}>
 {photos.map((uri,i)=><Pressable key={'photo:'+i} style={{width,height}} accessibilityLabel={`Open image ${i+1} of ${total}`} onPress={()=>{if(settled)onImage?.(i);}}><ResilientImage uri={uri} resizeMode="contain" style={{width,height}}/></Pressable>)}
 {clips.map((uri,i)=><View key={'video:'+i} style={{width,height}}><CachedListingVideo uri={uri} active={active&&settled&&index===photos.length+i}/></View>)}
 </ScrollView>{total>0&&<View pointerEvents="none" style={{position:'absolute',bottom:12,right:12,borderRadius:20,backgroundColor:'#000A',paddingHorizontal:12,paddingVertical:6}}><Text style={{color:'#FFF'}}>{Math.min(index+1,total)}/{total}</Text></View>}</View>;
}
