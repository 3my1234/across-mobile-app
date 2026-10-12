import React,{useEffect,useRef,useState} from "react";
import {ActivityIndicator,Image,Modal,PanResponder,Pressable,StyleSheet,Text,View} from "react-native";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {clampPhotoTransform,initialPhotoTransform,PhotoTransform,zoomPhotoAt} from "./photoZoom";

export function ChatPhotoViewer({uri,onClose}:{uri:string|null;onClose:()=>void}) {
 const insets=useSafeAreaInsets();
 const [transform,setTransform]=useState(initialPhotoTransform),[loading,setLoading]=useState(true),[error,setError]=useState(false);
 const canvas=useRef<View>(null),position=useRef({x:0,y:0});
 const current=useRef(transform),viewport=useRef({width:1,height:1}),image=useRef({width:1,height:1});
 const origin=useRef({count:0,x:0,y:0,distance:0,value:initialPhotoTransform}),lastTap=useRef(0),moved=useRef(false);
 function apply(value:PhotoTransform){const next=clampPhotoTransform(value,viewport.current,image.current);current.current=next;setTransform(next);}
 function reset(){apply(initialPhotoTransform);}
 useEffect(()=>{image.current={width:1,height:1};reset();setLoading(true);setError(false);lastTap.current=0;},[uri]);
 const gestures=useRef(PanResponder.create({
  onStartShouldSetPanResponder:()=>true,
  onPanResponderGrant:event=>{const touches=event.nativeEvent.touches;const count=Math.min(touches.length,2);origin.current={count,x:touches.reduce((sum,t)=>sum+t.pageX,0)/touches.length,y:touches.reduce((sum,t)=>sum+t.pageY,0)/touches.length,distance:count===2?Math.hypot(touches[1].pageX-touches[0].pageX,touches[1].pageY-touches[0].pageY):0,value:current.current};moved.current=false;},
  onPanResponderMove:event=>{
   const touches=event.nativeEvent.touches;if(!touches.length)return;
   const count=Math.min(touches.length,2),x=touches.reduce((sum,t)=>sum+t.pageX,0)/touches.length,y=touches.reduce((sum,t)=>sum+t.pageY,0)/touches.length;
   const distance=count===2?Math.hypot(touches[1].pageX-touches[0].pageX,touches[1].pageY-touches[0].pageY):0;
   if(origin.current.count!==count){origin.current={count,x,y,distance,value:current.current};return;}
   const start=origin.current;moved.current=true;
   let next=start.value;
   if(count===2 && start.distance>0)next=zoomPhotoAt(start.value,start.value.scale*distance/start.distance,{x:start.x-position.current.x-viewport.current.width/2,y:start.y-position.current.y-viewport.current.height/2});
   apply({...next,x:next.x+x-start.x,y:next.y+y-start.y});
  },
  onPanResponderRelease:()=>{if(!moved.current){const now=Date.now();if(now-lastTap.current<300){apply(current.current.scale>1?initialPhotoTransform:zoomPhotoAt(current.current,2.5,{x:0,y:0}));lastTap.current=0;}else lastTap.current=now;}origin.current.count=0;},
  onPanResponderTerminationRequest:()=>false
 })).current;
 return <Modal visible={!!uri} animationType="fade" statusBarTranslucent onRequestClose={onClose}>
  <View style={[s.fill,{paddingTop:insets.top,paddingBottom:insets.bottom}]}>
   <View style={s.toolbar}><Pressable accessibilityLabel="Close photo" onPress={onClose} style={s.control}><Text style={s.label}>Close</Text></Pressable><Text style={s.label}>Photo</Text><Pressable accessibilityLabel="Reset photo zoom" onPress={reset} style={s.control}><Text style={s.label}>Reset</Text></Pressable></View>
   <View ref={canvas} style={s.canvas} onLayout={event=>{viewport.current=event.nativeEvent.layout;canvas.current?.measureInWindow((x,y)=>{position.current={x,y};});apply(current.current);}} {...gestures.panHandlers}>
    {!!uri && <Image source={{uri}} resizeMode="contain" style={[s.photo,{transform:[{translateX:transform.x},{translateY:transform.y},{scale:transform.scale}]}]} onLoad={event=>{const source=event.nativeEvent.source;if(source.width&&source.height)image.current={width:source.width,height:source.height};setLoading(false);apply(current.current);}} onError={()=>{setLoading(false);setError(true);}}/>}
    {loading && <ActivityIndicator color="#FFFFFF" style={s.indicator}/>}
    {error && <Text style={s.failure}>Photo could not be loaded. Close and reopen it to try again.</Text>}
   </View>
   <View style={s.toolbar}><Pressable accessibilityLabel="Zoom out" onPress={()=>apply(zoomPhotoAt(current.current,current.current.scale/1.5,{x:0,y:0}))} style={s.control}><Text style={s.label}>-</Text></Pressable><Text style={s.hint}>Pinch or double tap to zoom</Text><Pressable accessibilityLabel="Zoom in" onPress={()=>apply(zoomPhotoAt(current.current,current.current.scale*1.5,{x:0,y:0}))} style={s.control}><Text style={s.label}>+</Text></Pressable></View>
  </View>
 </Modal>;
}
const s=StyleSheet.create({fill:{flex:1,backgroundColor:"#080A09"},toolbar:{height:56,flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingHorizontal:12},control:{minWidth:56,minHeight:44,alignItems:"center",justifyContent:"center"},label:{color:"#FFFFFF",fontSize:16},hint:{color:"#D4DAD7",fontSize:12},canvas:{flex:1,overflow:"hidden"},photo:{width:"100%",height:"100%"},indicator:{position:"absolute",top:"48%",left:"48%"},failure:{color:"#FFFFFF",position:"absolute",top:"45%",left:20,right:20,textAlign:"center"}});
