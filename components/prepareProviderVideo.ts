import {Video,getVideoMetaData} from 'react-native-compressor';
import {File} from 'expo-file-system';

type Input={uri:string;duration?:number|null;fileSize?:number|null;mimeType?:string|null};
type Limits={max_video_seconds:number;max_video_bytes?:number};
let preparing=false;
const uploadCeiling=50*1024*1024,sourceCeiling=2*1024*1024*1024;
function removeCopy(uri:string,original:string) {
 // Delete only the native encoder's returned file, never the selected original.
 if(uri===original||!uri.startsWith('file://'))return;
 try{const file=new File(uri);if(file.exists)file.delete();}catch{/* OS cache eviction remains a fallback. */}
}
export async function prepareProviderVideo(input:Input,limits:Limits,signal:AbortSignal,progress:(percent:number)=>void=()=>{}) {
 if(preparing)throw Error('Another video is still being prepared or stopping. Please wait.');
 if(signal.aborted)throw Error('Video preparation cancelled.');
 if(!/^(file|content|ph):\/\//i.test(input.uri))throw Error('Choose a video from your phone.');
 if(!Number.isFinite(limits.max_video_seconds)||limits.max_video_seconds<1)throw Error('Your video limits are unavailable. Refresh before uploading.');
 const seconds=Math.min(180,limits.max_video_seconds),maxBytes=Math.min(uploadCeiling,limits.max_video_bytes||uploadCeiling);
 if(input.duration&&input.duration>seconds*1000)throw Error(`Choose a video up to ${seconds} seconds. Trim a longer recording first.`);
 if(input.fileSize&&input.fileSize>sourceCeiling)throw Error('This recording exceeds 2 GiB. Trim it or export a smaller copy first.');
 preparing=true;
 let cancellationID='',stopped=false,output='',accepted=false,native:Promise<string>|undefined;
 let rejectStop:(error:Error)=>void=()=>{};
 const cancelled=new Promise<never>((_resolve,reject)=>{rejectStop=reject;});
 const stop=(message:string)=>{if(stopped)return;stopped=true;try{if(cancellationID)Video.cancelCompression(cancellationID);}catch{}rejectStop(Error(message));};
 const abort=()=>stop('Video preparation cancelled. Your original recording was kept.');
 const timeout=setTimeout(()=>stop('Preparing this video took too long. Trim it or export a smaller copy and retry.'),5*60*1000);
 signal.addEventListener('abort',abort);
 try {
  const source=await Promise.race([getVideoMetaData(input.uri),cancelled]);
  const duration=Number(source.duration),width=Number(source.width),height=Number(source.height),sourceBytes=Number(source.size);
  if(!Number.isFinite(duration)||duration<=0||duration>seconds)throw Error(`Choose a playable video up to ${seconds} seconds.`);
  if(!Number.isFinite(sourceBytes)||sourceBytes<=0||sourceBytes>sourceCeiling)throw Error('Choose a readable video smaller than 2 GiB.');
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0||Math.max(width,height)>8192||width*height>35000000)throw Error('This recording resolution is unsupported. Export a 720p copy first.');
  // Preserve orientation/aspect ratio; at most 720px on the short edge, 1280px long.
  const maxSize=Math.floor(Math.min(1280,Math.max(width,height),720*Math.max(width,height)/Math.min(width,height)));
  progress(0);
  native=Video.compress(input.uri,{compressionMethod:'manual',maxSize,bitrate:1200000,minimumFileSizeForCompress:0,getCancellationId:id=>{cancellationID=id;if(stopped)throw Error('Video preparation cancelled.');}},value=>{if(!stopped&&Number.isFinite(value))progress(Math.max(0,Math.min(100,Math.round(value*100))));});
  // A cancelled native operation can finish late; discard only that generated copy.
  void native.then(uri=>{if(stopped)removeCopy(uri,input.uri);}).catch(()=>{});
  output=await Promise.race([native,cancelled]);
  const prepared=await Promise.race([getVideoMetaData(output),cancelled]);
  const size=Number(prepared.size),length=Number(prepared.duration);
  if(String(prepared.extension).toLowerCase()!=='mp4'||!Number.isFinite(length)||length<=0||length>seconds)throw Error(`The prepared video must be an MP4 up to ${seconds} seconds. Please trim it and retry.`);
  if(!Number.isFinite(size)||size<=0||size>maxBytes)throw Error(`The prepared video is still larger than ${Math.floor(maxBytes/1024/1024)} MiB. Please trim it and retry.`);
  progress(100);accepted=true;
  return {uri:output,mimeType:'video/mp4',fileName:'post.mp4',fileSize:size,duration:length*1000,cleanup:()=>removeCopy(output,input.uri)};
 }catch(error){
  if(stopped||error instanceof Error&&/Choose|recording|prepared|readable|video limits/i.test(error.message))throw error;
  throw Error('Could not prepare this recording. Your original is unchanged. Try a shorter clip or export an MP4 from your gallery.');
 }finally {
  clearTimeout(timeout);signal.removeEventListener('abort',abort);
  if(!accepted&&output)removeCopy(output,input.uri);
  // Do not start a second encoder while cancellation of the first is unfinished.
  if(native)void native.then(()=>{preparing=false;},()=>{preparing=false;});else preparing=false;
 }
}
