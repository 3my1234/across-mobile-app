import React,{createContext,useCallback,useEffect,useRef} from 'react';
import {Keyboard,Platform,ScrollView,FlatList,findNodeHandle,type ScrollViewProps,type FlatListProps,type TextInput} from 'react-native';

// Use the nearest scroll container: scrolling an outer form instead of its
// nested editor can hide the caret again. No global input text is retained.
export const InputScrollContext=createContext<((input:TextInput|null)=>void)|null>(null);
function useInputReveal(scroll:React.RefObject<ScrollView|FlatList<unknown>|null>){
 const offset=useRef(0),keyboardTop=useRef<number|undefined>(Keyboard.metrics?.()?.screenY);
 const focused=useRef<TextInput|null>(null),task=useRef<ReturnType<typeof setTimeout>|null>(null),settle=useRef<ReturnType<typeof setTimeout>|null>(null);
 const reveal=useCallback((input:TextInput|null)=>{
  const changed=focused.current!==input;
  focused.current=input;
  if(changed||!input){if(settle.current)clearTimeout(settle.current);settle.current=null;}
  // Android can resize the viewport after the focus/keyboard callbacks. Check
  // once more after that animation, without waiting for a keystroke.
  if(changed&&input)settle.current=setTimeout(()=>{settle.current=null;if(focused.current===input)reveal(input);},280);
  if(task.current)clearTimeout(task.current);
  if(!input)return;
  task.current=setTimeout(()=>{
   task.current=null;
   if(!focused.current?.isFocused())return;
   const node=findNodeHandle(focused.current),container=scroll.current;
   const responder=container&&'getScrollResponder' in container?container.getScrollResponder():null;
   if(!node||!responder)return;
   const editor=focused.current;
   const native=responder as unknown as {measure?:TextInput['measure'];scrollTo?:(options:{y:number;animated:boolean})=>void};
   if(typeof editor.measure==='function'&&typeof native.measure==='function') {
    native.measure((_x:number,_y:number,_w:number,h:number,_px:number,top:number)=>{
     editor.measure((_ix,_iy,_iw,height,_ipx,y)=>{
      if(focused.current!==editor||!editor.isFocused()||h<=0||height<=0)return;
      const bottom=Math.min(top+h,keyboardTop.current??Infinity)-12,upper=top+12;
      const delta=height>bottom-upper?y-upper:y<upper?y-upper:y+height>bottom?y+height-bottom:0;
      if(Math.abs(delta)<3)return; // Already visible: typing must never recenter the form.
      const next=Math.max(0,offset.current+delta);
      offset.current=next;
      native.scrollTo?.({y:next,animated:false});
     });
    });
   }else if('scrollResponderScrollNativeHandleToKeyboard' in responder)responder.scrollResponderScrollNativeHandleToKeyboard(node,12,true);
  },60);
 },[scroll]);
 useEffect(()=>{
  const events=[Keyboard.addListener('keyboardDidShow',event=>{keyboardTop.current=event?.endCoordinates?.screenY??Keyboard.metrics?.()?.screenY;reveal(focused.current);}),Keyboard.addListener('keyboardDidHide',()=>{keyboardTop.current=undefined;})];
  if(Platform.OS==='ios')events.push(Keyboard.addListener('keyboardDidChangeFrame',event=>{keyboardTop.current=event.endCoordinates.screenY;reveal(focused.current);}));
  return()=>{events.forEach(event=>event.remove());if(task.current)clearTimeout(task.current);if(settle.current)clearTimeout(settle.current);focused.current=null;};
 },[reveal]);
 return {reveal,layout:()=>reveal(focused.current),onScroll:(event:{nativeEvent:{contentOffset:{y:number}}})=>{offset.current=event.nativeEvent.contentOffset.y;}};
}
export type KeyboardScrollView=ScrollView;
export const KeyboardScrollView=React.forwardRef<ScrollView,ScrollViewProps>(function KeyboardScrollView({children,onLayout,onScroll,...props},forwarded){
 const scroll=useRef<ScrollView|null>(null),coordinator=useInputReveal(scroll);
 return <ScrollView {...props} ref={node=>{scroll.current=node;if(typeof forwarded==='function')forwarded(node);else if(forwarded)forwarded.current=node;}} scrollEventThrottle={16} onScroll={event=>{coordinator.onScroll(event);onScroll?.(event);}} onLayout={event=>{onLayout?.(event);coordinator.layout();}}><InputScrollContext.Provider value={coordinator.reveal}>{children}</InputScrollContext.Provider></ScrollView>;
});
// React Native owns focus, including inputs in virtualized list headers.
// Keep the public generic/ref API used by the existing lists.
export type KeyboardFlatList<T>=FlatList<T>;
export const KeyboardFlatList=React.forwardRef(function KeyboardFlatList<T>({onLayout,onScroll,...props}:FlatListProps<T>,forwarded:React.ForwardedRef<FlatList<T>>){
 const scroll=useRef<FlatList<T>|null>(null),coordinator=useInputReveal(scroll as React.RefObject<FlatList<unknown>|null>);
 return <InputScrollContext.Provider value={coordinator.reveal}><FlatList {...props} ref={node=>{scroll.current=node;if(typeof forwarded==='function')forwarded(node);else if(forwarded)forwarded.current=node;}} scrollEventThrottle={16} onScroll={event=>{coordinator.onScroll(event);onScroll?.(event);}} onLayout={event=>{onLayout?.(event);coordinator.layout();}}/></InputScrollContext.Provider>;
}) as <T>(props:FlatListProps<T>&React.RefAttributes<FlatList<T>>)=>React.ReactElement;
