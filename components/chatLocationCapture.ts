import * as Location from 'expo-location';
import {currentForegroundLocation} from './foregroundLocation';
import {ChatLocation,validLocation} from './chatLocation';

// Draft-only metadata: the existing server wire format stays unchanged.
export type ChatLocationDraft={pin:ChatLocation;source:'gps'|'map';capturedAt:number};
const MAX_FIX_AGE_MS=15000,MAX_ACCURACY_M=100,MAX_UNSENT_AGE_MS=120000;
export function chatDraftFromGPS(position:Location.LocationObject,now=Date.now()):ChatLocationDraft{
 const coords=position?.coords;
 if(!validLocation(coords))throw Error('Your phone did not provide a valid position. Retry GPS or choose a point on the map.');
 if(!Number.isFinite(position.timestamp)||now-position.timestamp>MAX_FIX_AGE_MS||position.timestamp-now>5000)throw Error('Your phone returned an old location. Retry GPS or choose a point on the map.');
 if(typeof coords.accuracy!=='number'||!Number.isFinite(coords.accuracy)||coords.accuracy<0||coords.accuracy>MAX_ACCURACY_M)throw Error('A more accurate location is needed. Enable precise location, move to a clearer area, or choose a point on the map.');
 return {pin:{latitude:coords.latitude,longitude:coords.longitude,accuracy_m:coords.accuracy},source:'gps',capturedAt:position.timestamp};
}
export async function captureChatLocation(){
 // Driver availability keeps its existing Balanced accuracy and deadlines.
 return chatDraftFromGPS(await currentForegroundLocation(undefined,{accuracy:Location.Accuracy.High,timeoutMs:20000}));
}
export function chatDraftFromMap(point:ChatLocation,now=Date.now()):ChatLocationDraft{
 if(!validLocation(point))throw Error('Choose a valid point on the map.');
 return {pin:{latitude:point.latitude,longitude:point.longitude},source:'map',capturedAt:now};
}
export function chatDraftNeedsRefresh(draft:ChatLocationDraft,now=Date.now()){
 // A deliberately selected pickup can be somewhere other than the sender's
 // present position. Never silently move it or recapture on a send retry.
 return draft.source==='gps'&&(!Number.isFinite(draft.capturedAt)||now-draft.capturedAt>MAX_UNSENT_AGE_MS||draft.capturedAt-now>5000);
}
