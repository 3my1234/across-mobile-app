import React, { useRef } from 'react';
import { View } from 'react-native';

// Retain only the two virtualized browsing feeds, after their first visit. The
// account key owns their lifetime; signing out must discard the previous feed.
// Keep a full-size layout while hidden so FlatList does not recycle the viewport.
export function RetainedFeedTab({active,children}:{active:boolean;children:React.ReactNode}) {
  const visited=useRef(false);
  if(active)visited.current=true;
  if(!visited.current)return null;
  return <View pointerEvents={active?'auto':'none'} accessibilityElementsHidden={!active}
    importantForAccessibility={active?'auto':'no-hide-descendants'}
    style={active?{flex:1}:{position:'absolute',top:0,left:0,width:'100%',height:'100%',opacity:0,zIndex:-1}}>
    {children}
  </View>;
}
