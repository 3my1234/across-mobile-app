import React,{createContext,useCallback,useEffect,useRef} from 'react';
import {Keyboard,Platform,ScrollView,FlatList,findNodeHandle,TextInput as KeyboardInput,type ScrollViewProps,type FlatListProps,type TextInput} from 'react-native';

// Use the nearest scroll container: scrolling an outer form instead of its
// nested editor can hide the caret again. No global input text is retained.
export const InputScrollContext=createContext<((input:TextInput|null)=>void)|null>(null);
function useInputReveal(scroll:React.RefObject<ScrollView|FlatList<unknown>|null>){
 const focused=useRef<TextInput|null>(null),task=useRef<ReturnType<typeof setTimeout>|null>(null);
 const reveal=useCallback((input:TextInput|null)=>{
  focused.current=input;
  if(task.current)clearTimeout(task.current);
  if(!input)return;
  task.current=setTimeout(()=>{
   task.current=null;
   if(!focused.current?.isFocused())return;
   const node=findNodeHandle(focused.current),container=scroll.current;
   const responder=container&&'getScrollResponder' in container?container.getScrollResponder():null;
   if(node&&responder&&'scrollResponderScrollNativeHandleToKeyboard' in responder)responder.scrollResponderScrollNativeHandleToKeyboard(node,20,true);
  },60);
 },[scroll]);
 useEffect(()=>{
  const events=[Keyboard.addListener('keyboardDidShow',()=>reveal(focused.current))];
  if(Platform.OS==='ios')events.push(Keyboard.addListener('keyboardDidChangeFrame',()=>reveal(focused.current)));
  return()=>{events.forEach(event=>event.remove());if(task.current)clearTimeout(task.current);focused.current=null;};
 },[reveal]);
 return reveal;
}
export type KeyboardScrollView=ScrollView;
export const KeyboardScrollView=React.forwardRef<ScrollView,ScrollViewProps>(function KeyboardScrollView({children,onLayout,...props},forwarded){
 const scroll=useRef<ScrollView|null>(null),reveal=useInputReveal(scroll);
 return <ScrollView {...props} ref={node=>{scroll.current=node;if(typeof forwarded==='function')forwarded(node);else if(forwarded)forwarded.current=node;}} onLayout={event=>{onLayout?.(event);const input=KeyboardInput.State.currentlyFocusedInput() as TextInput|null;if(input?.isFocused())reveal(input);}}><InputScrollContext.Provider value={reveal}>{children}</InputScrollContext.Provider></ScrollView>;
});
// React Native owns focus, including inputs in virtualized list headers.
// Keep the public generic/ref API used by the existing lists.
export type KeyboardFlatList<T>=FlatList<T>;
export const KeyboardFlatList=React.forwardRef(function KeyboardFlatList<T>({onLayout,...props}:FlatListProps<T>,forwarded:React.ForwardedRef<FlatList<T>>){
 const scroll=useRef<FlatList<T>|null>(null),reveal=useInputReveal(scroll as React.RefObject<FlatList<unknown>|null>);
 return <InputScrollContext.Provider value={reveal}><FlatList {...props} ref={node=>{scroll.current=node;if(typeof forwarded==='function')forwarded(node);else if(forwarded)forwarded.current=node;}} onLayout={event=>{onLayout?.(event);const input=KeyboardInput.State.currentlyFocusedInput() as TextInput|null;if(input?.isFocused())reveal(input);}}/></InputScrollContext.Provider>;
}) as <T>(props:FlatListProps<T>&React.RefAttributes<FlatList<T>>)=>React.ReactElement;
