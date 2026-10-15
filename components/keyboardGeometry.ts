export type WindowFrame={x:number;y:number;width:number;height:number};
export type KeyboardBounds={screenX:number;screenY:number;width:number;height:number};
// ATL's edge-to-edge React root starts at the full-screen origin. Native
// measure() page coordinates retain its safe-area/header offsets on Android;
// measureInWindow() subtracts the visible window inset and is incompatible here.
export function keyboardOverlap(frame:WindowFrame,keyboard?:KeyboardBounds|null,extraOffset=0){
 if(!keyboard||keyboard.height<=0||keyboard.screenY<=0||frame.height<=0)return 0;
 if(frame.x+frame.width<=keyboard.screenX||keyboard.screenX+keyboard.width<=frame.x)return 0;
 return Math.min(frame.height,Math.max(0,frame.y+frame.height-keyboard.screenY+extraOffset));
}
