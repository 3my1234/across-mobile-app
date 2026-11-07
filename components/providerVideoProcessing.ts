type VideoState={status?:string;url?:string;key?:string;message?:string};
export async function waitForProviderVideo(initial:VideoState,key:string,read:(path:string)=>Promise<VideoState>,active:()=>boolean=()=>true,sleep:(ms:number)=>Promise<void>=ms=>new Promise(resolve=>setTimeout(resolve,ms))){
 let state=initial;
 for(let attempt=0;attempt<60;attempt++){
  if(state.url)return state;
  if(state.status==='failed')throw Error(state.message||'This video could not be processed. Please upload it again.');
  if(!active())throw Error('Video processing continues. Reopen your provider account to check it.');
  await sleep(Math.min(2000+attempt*500,6000));
  state=await read(`/providers/me/videos/status?key=${encodeURIComponent(key)}`);
 }
 throw Error('Your video is still processing. Check its status before uploading it again.');
}
