import React, {useEffect, useId, useRef, useState} from "react";
import {AccessibilityInfo, Alert, Animated, AppState, Pressable, StyleSheet, View} from "react-native";
import Svg, {Defs, LinearGradient, Path, Stop} from "react-native-svg";
import {ThemedText as Text, useTheme} from "./ThemeProvider";
import {ResilientImage} from "./ResilientImage";

export type ProviderIdentityData = {id?:string; name:string; avatar_url?:string; banner_url?:string; verified:boolean; paid_active?:boolean; tier?:""|"bronze"|"silver"|"gold"|"diamond"; label?:string};
const finishes = {
 bronze:["#713C24","#E8B18D","#A15E3B"], silver:["#657482","#F2F7FC","#9EAAB6"],
 gold:["#96700D","#FFE79A","#DCA82B"], diamond:["#759FC0","#F0FFFF","#CABFF2"],
 neutral:["#65736D","#9CA9A3","#65736D"]
};
// Original twelve-lobed seal, generated as a vector once at module load.
const seal = Array.from({length:145},(_,i)=>{const a=i*Math.PI*2/144,r=13.5+1.15*Math.cos(a*12);return `${i?"L":"M"}${(16+r*Math.cos(a)).toFixed(2)},${(16+r*Math.sin(a)).toFixed(2)}`;}).join(" ")+" Z";
const AnimatedGradient = Animated.createAnimatedComponent(LinearGradient);

export function ProviderBadge({identity,size=18,animate=false}:{identity:ProviderIdentityData;size?:number;animate?:boolean}) {
 const uid=useId().replace(/[^a-z0-9]/gi,"");
 const phase=useRef(new Animated.Value(-32)).current;
 const [reduce,setReduce]=useState(true),[foreground,setForeground]=useState(AppState.currentState==="active");
 useEffect(()=>{if(!animate)return;let alive=true;AccessibilityInfo.isReduceMotionEnabled().then(value=>{if(alive)setReduce(value);}).catch(()=>{});const motion=AccessibilityInfo.addEventListener("reduceMotionChanged",setReduce);const app=AppState.addEventListener("change",value=>setForeground(value==="active"));return()=>{alive=false;motion.remove();app.remove();};},[animate]);
 const tier=identity.verified && identity.paid_active && identity.tier && identity.tier in finishes ? identity.tier : "neutral";
 useEffect(()=>{phase.setValue(-32);if(!animate || reduce || !foreground || tier==="neutral")return;const loop=Animated.loop(Animated.timing(phase,{toValue:32,duration:6000,useNativeDriver:false}));loop.start();return()=>loop.stop();},[animate,reduce,foreground,tier,phase]);
 if(!identity.verified)return null;
 const colors=finishes[tier];
 const label=identity.label || ("Verified provider - " + (tier!=="neutral" ? tier[0].toUpperCase()+tier.slice(1)+" subscription" : "Free plan"));
 return <Pressable hitSlop={8} accessibilityRole="button" accessibilityLabel={label} accessibilityHint="Explains provider verification and subscription badge" onPress={()=>Alert.alert(label,"Verification means the provider’s documents were approved. Badge colour indicates subscription tier, not service quality or a payment guarantee.")} style={{width:size,height:size,shadowColor:colors[1],shadowOpacity:.18,shadowRadius:3}}>
  <Svg width={size} height={size} viewBox="0 0 32 32">
   <Defs><LinearGradient id={`metal${uid}`} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor={colors[0]}/><Stop offset=".48" stopColor={colors[1]}/><Stop offset="1" stopColor={colors[2]}/></LinearGradient>
    <AnimatedGradient id={`shine${uid}`} gradientUnits="userSpaceOnUse" x1={phase} x2={Animated.add(phase,32)} y1={0} y2={32}><Stop offset="0" stopColor="#FFFFFF" stopOpacity="0"/><Stop offset=".5" stopColor="#FFFFFF" stopOpacity=".35"/><Stop offset="1" stopColor="#FFFFFF" stopOpacity="0"/></AnimatedGradient>
   </Defs>
   <Path d={seal} fill={`url(#metal${uid})`} stroke={colors[0]} strokeWidth=".5"/>
   {animate && !reduce && foreground && tier!=="neutral" && <Path d={seal} fill={`url(#shine${uid})`}/>}
   <Path d="M9.5 16.2 L14 20.5 L22.5 11.5" fill="none" stroke={tier==="bronze"?"#FFFFFF":"#20332C"} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
 </Pressable>;
}

export function ProviderBanner({identity,compact=false}:{identity?:ProviderIdentityData;compact?:boolean}) {
 if(!identity?.banner_url)return null;
 return <ResilientImage uri={identity.banner_url} style={{width:'100%',height:compact?44:96,borderRadius:10,marginVertical:5}} resizeMode="cover"/>;
}
export function ProviderIdentity({identity,animate=false,compact=true}:{identity?:ProviderIdentityData;animate?:boolean;compact?:boolean}) {
 const theme=useTheme();
 if(!identity?.name)return null;
 const size=compact?22:30;
 return <View style={styles.row}>
  {identity.avatar_url?<ResilientImage uri={identity.avatar_url} style={{width:size,height:size,borderRadius:size/2}} resizeMode="cover"/>:<View style={[styles.avatar,{width:size,height:size,borderRadius:size/2,backgroundColor:theme.color("#E8EEEB","backgroundColor")}]}><Text style={styles.initial}>{identity.name.slice(0,1).toUpperCase()}</Text></View>}
  <Text style={[styles.name,!compact&&{fontSize:13}]} numberOfLines={1}>{identity.name}</Text>
  <ProviderBadge identity={identity} animate={animate}/>
 </View>;
}
const styles=StyleSheet.create({row:{flexDirection:"row",alignItems:"center",gap:5,marginVertical:4,minWidth:0},name:{fontSize:11,lineHeight:16,flexShrink:1,fontWeight:"600"},avatar:{alignItems:"center",justifyContent:"center"},initial:{fontSize:11,fontWeight:"700"}});
