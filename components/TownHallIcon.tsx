import React from "react";
import Svg,{Path,Rect,Circle,Defs,LinearGradient,Stop} from "react-native-svg";

// Original civic hall + conversation mark. Shared geometry with portal hall-icon.js.
export function TownHallIcon({size=30}:{size?:number}){
 const id=React.useId().replace(/:/g,'');
 return <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityElementsHidden>
  <Defs><LinearGradient id={id} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#55E9B0"/><Stop offset="1" stopColor="#007B64"/></LinearGradient></Defs>
  <Circle cx="32" cy="32" r="31" fill={`url(#${id})`}/>
  <Path d="M13 27 32 15l19 12H13Z" fill="#FFF"/>
  <Path d="M17 48h30M15 52h34M21 30v14m11-14v14m11-14v14" stroke="#FFF" strokeWidth="4" strokeLinecap="round"/>
  <Rect x="38" y="7" width="20" height="14" rx="6" fill="#064F42"/>
  <Path d="m43 19-3 6 10-5" fill="#064F42"/>
  <Circle cx="43" cy="14" r="1.5" fill="#FFF"/><Circle cx="48" cy="14" r="1.5" fill="#FFF"/><Circle cx="53" cy="14" r="1.5" fill="#FFF"/>
 </Svg>;
}
