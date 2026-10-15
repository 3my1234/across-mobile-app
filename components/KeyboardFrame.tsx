import React,{useEffect,useRef,useState} from 'react';
import {Keyboard,type KeyboardAvoidingViewProps,type KeyboardEvent,Platform,View} from 'react-native';
import {keyboardOverlap,type KeyboardBounds} from './keyboardGeometry';

// Current native geometry accommodates adjustResize, edge-to-edge IME overlap
// and disappearing navigation without subtracting the keyboard twice.
export function KeyboardFrame({children,style,behavior:_behavior,keyboardVerticalOffset=0,enabled=true,contentContainerStyle,onLayout,...props}:KeyboardAvoidingViewProps){
 const frame=useRef<View>(null),keyboard=useRef<KeyboardBounds|null>(null),alive=useRef(true),raf=useRef<number|null>(null),version=useRef(0);
 const [overlap,setOverlap]=useState(0);
 const settings=useRef({enabled,keyboardVerticalOffset});settings.current={enabled,keyboardVerticalOffset};
 function measure(){
  if(raf.current!==null)cancelAnimationFrame(raf.current);
  const request=++version.current;
  raf.current=requestAnimationFrame(()=>{raf.current=null;frame.current?.measure((_x,_y,width,height,pageX,pageY)=>{
   if(!alive.current||request!==version.current)return;
   setOverlap(settings.current.enabled?keyboardOverlap({x:pageX,y:pageY,width,height},keyboard.current,settings.current.keyboardVerticalOffset):0);
  });});
 }
 useEffect(()=>{
  alive.current=true;keyboard.current=Keyboard.metrics?.()||null;measure();
  const show=(event:KeyboardEvent)=>{keyboard.current=event.endCoordinates;if(Platform.OS==='ios')Keyboard.scheduleLayoutAnimation(event);measure();};
  const hide=(event:KeyboardEvent)=>{keyboard.current=null;version.current++;setOverlap(0);if(Platform.OS==='ios')Keyboard.scheduleLayoutAnimation(event);measure();};
  const subscriptions=[Keyboard.addListener('keyboardDidShow',show),Keyboard.addListener(Platform.OS==='ios'?'keyboardWillHide':'keyboardDidHide',hide)];
  if(Platform.OS==='ios')subscriptions.push(Keyboard.addListener('keyboardWillShow',show));
  return()=>{alive.current=false;version.current++;if(raf.current!==null)cancelAnimationFrame(raf.current);subscriptions.forEach(item=>item.remove());};
 },[]);
 useEffect(()=>{measure();},[enabled,keyboardVerticalOffset]);
 return <View {...props} ref={frame} collapsable={false} style={style} onLayout={event=>{onLayout?.(event);measure();}}><View style={[{flex:1,minHeight:0,paddingBottom:enabled?overlap:0},contentContainerStyle]}>{children}</View></View>;
}
