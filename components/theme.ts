export const COLORS = {
  primary: "#FF4747",
  primaryPressed: "#E83E3E",
  primarySoft: "#FFF1F1",
  star: "#FFB400",
  text: "#191919",
  muted: "#8C8C8C",
  surface: "#FFFFFF",
  background: "#F5F5F5"
} as const;

// Explicit semantic groups preserve brand, star and photo-overlay colours.
const groups:Record<string,string[]>={
  surface:["#FFFFFF","#FFF","rgba(255,255,255,0.94)","rgba(255,255,255,0.72)"],
  background:["#F5F5F5","#F7F8F8","#F3F4F4","#F3F3F3","#F7F7F7","#F0F0F0","#F5F7F6","#F8FAF9","#FFF8F1","#F0F4F2","rgba(255,248,241,0.28)"],
  border:["#EDEDED","#DEDEDE","#EEE","#E5E5E5","#ECECEC","#DDD","#E8E8E8","#E7E7E7","#D7D7D7","#D0D5DD","#EAF1ED","#E8EFEC","#E5E7EB","#D9E9E2","#E2E7E4","#E7EAE8","#DDE2DF","#D9E0DD","#D9D9D9","rgba(226,231,228,0.92)"],
  text:["#191919","#333","#444","#555","#111","#000","#000000","#102C25","#19332B","#30423D","#101817","#202725","#17201D","#35413D"],
  muted:["#777","#AAA","#4F4F4F","#66736F","#888","#595959","#6F6F6F","#8C8C8C","#667085","#BFBFBF","#4E625C","#55615D","#66706D","#89918E","#909895"],
  redSoft:["#FFF4F4","#FFF1F1","#FFE3E3","#FFD0D0","#FFF5F5","#FFD6D6","#FFF0EF"],
  red:["#C62828","#C9353B","#A5282E","#D72736","#B42318","#D71920"],
  green:["#12805F","#315B3B"],
  greenSoft:["#F0F8F1","#EAF8F2","#CBEBDD","#F3F8F6"],
  amber:["#9A5B00","#A66A00","#7A4600","#6C4A20","#B54708"],
  amberSoft:["#FFF5E6","#FFF0D6","#FFF1DD","#FFFAEB","#FEDF89"],
  blue:["#52679A"]
};
const darkColours:Record<string,string>={surface:"#1C2522",background:"#111815",border:"#394540",text:"#F1F4F3",muted:"#B5C0BC",redSoft:"#3A2428",red:"#FF9299",green:"#75D6AF",greenSoft:"#20392F",amber:"#FFD18A",amberSoft:"#3B3021",blue:"#A7BFF4"};
const colourGroups=new Map(Object.entries(groups).flatMap(([group,colours])=>colours.map(colour=>[colour.toUpperCase(),group] as const)));
export function themeColor(value:string,role="color",dark=false):string {
  if(!dark || role==="shadowColor")return value;
  const group=colourGroups.get(value.toUpperCase());
  if(!group)return value;
  if(role.includes("border"))return ["border","surface","background","muted"].includes(group) ? darkColours.border : value;
  if(role==="backgroundColor"){
    // Black image overlays, launch screens and selected controls stay dark.
    if(group==="text")return value;
    if(group==="border")return "#29342F";
    if(["red","green","amber","blue"].includes(group))return value;
    return darkColours[group] || value;
  }
  // White text on primary buttons and image overlays must stay white.
  if(group==="surface")return value;
  if(group==="border")return "#A2ADA8";
  return darkColours[group] || value;
}
export function themeStyles<T>(styles:T,dark:boolean):T {
  if(!dark)return styles;
  return Object.fromEntries(Object.entries(styles as Record<string,Record<string,unknown>>).map(([name,style])=>[name,Object.fromEntries(Object.entries(style).map(([key,value])=>[key,typeof value==="string" && (key==="color" || key.endsWith("Color")) ? themeColor(value,key,true) : value]))])) as T;
}
