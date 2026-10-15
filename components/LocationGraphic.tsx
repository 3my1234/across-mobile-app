import React from 'react';
import Svg,{Path,Circle} from 'react-native-svg';
// A folded-map icon, not a geographic preview of the shared coordinates.
export function LocationGraphic(){return <Svg width={64} height={64} viewBox="0 0 64 64" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
 <Path d="M4 20 22 14 42 20 60 14v38l-18 6-20-6-18 6Z" fill="#DDF3E9" stroke="#12805F" strokeWidth={2} strokeLinejoin="round"/>
 <Path d="M22 14v38l20 6V20" fill="#BCE4D3" stroke="#12805F" strokeWidth={2} strokeLinejoin="round"/>
 <Path d="m8 44 11-7 10 7 17-11 10 4" fill="none" stroke="#FFF" strokeWidth={4} strokeLinecap="round"/>
 <Path d="M44 17c0 8-12 20-12 20S20 25 20 17a12 12 0 1 1 24 0Z" fill="#12805F" stroke="#FFF" strokeWidth={2}/>
 <Circle cx={32} cy={17} r={4} fill="#FFF"/>
 </Svg>;}
