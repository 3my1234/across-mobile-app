import {setVideoCacheSizeAsync} from 'expo-video';
let setup:Promise<boolean>|undefined;
// One shared native cache for sponsored ads, listing galleries and provider previews.
export function prepareVideoCache(){return setup??=(setVideoCacheSizeAsync(128*1024*1024).then(()=>true).catch(()=>false));}
export const videoBufferOptions={preferredForwardBufferDuration:3,minBufferForPlayback:.5,maxBufferBytes:8*1024*1024,waitsToMinimizeStalling:false};
