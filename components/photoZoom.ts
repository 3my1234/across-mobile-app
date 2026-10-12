export type PhotoTransform = {scale:number;x:number;y:number};
export const initialPhotoTransform:PhotoTransform={scale:1,x:0,y:0};
export function clampPhotoTransform(value:PhotoTransform,viewport:{width:number;height:number},image:{width:number;height:number}):PhotoTransform {
 const scale=Math.max(1,Math.min(5,value.scale));
 const ratio=Math.min(viewport.width/image.width,viewport.height/image.height);
 const maxX=Math.max(0,(image.width*ratio*scale-viewport.width)/2);
 const maxY=Math.max(0,(image.height*ratio*scale-viewport.height)/2);
 return {scale,x:Math.max(-maxX,Math.min(maxX,value.x)),y:Math.max(-maxY,Math.min(maxY,value.y))};
}
export function zoomPhotoAt(value:PhotoTransform,scale:number,point:{x:number;y:number}):PhotoTransform {
 const next=Math.max(1,Math.min(5,scale)),ratio=next/value.scale;
 return {scale:next,x:point.x-(point.x-value.x)*ratio,y:point.y-(point.y-value.y)*ratio};
}
