import React from 'react';
import {Alert,Linking,Pressable,View} from 'react-native';
import {ThemedText as Text} from './ThemeProvider';
import {Ionicons} from '@expo/vector-icons';
export function PostVideos({urls}:{urls?:string[]}){return <View style={{gap:8}}>{(Array.isArray(urls)?urls:[]).filter(url=>typeof url==='string'&&/^https:\/\//.test(url)).slice(0,5).map((url,index)=><Pressable key={url} accessibilityRole="link" accessibilityLabel={'Play video '+(index+1)} onPress={()=>void Linking.openURL(url).catch(()=>Alert.alert('Video unavailable','Please check your connection and try again.'))} style={{padding:14,borderRadius:10,backgroundColor:'#12805F',flexDirection:'row',alignItems:'center',gap:10}}><Ionicons name="play-circle-outline" size={26} color="#FFF"/><Text style={{color:'#FFF'}}>Play video {index+1} · up to 60 seconds</Text></Pressable>)}</View>}
