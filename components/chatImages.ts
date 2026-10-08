import { API_URL } from "./config";
import { fetchJSONWithTimeout } from "./utils";

export async function uploadChatImage(token: string, asset: {uri:string;mimeType?:string|null;fileName?:string|null;fileSize?:number}) {
  const mime=asset.mimeType || "image/jpeg";
  if (!["image/jpeg","image/png","image/webp"].includes(mime)) throw new Error("Choose a JPG, PNG or WebP image.");
  if (asset.fileSize && asset.fileSize>5*1024*1024) throw new Error("Each photo must be no larger than 5 MB.");
  const blob=await fetch(asset.uri).then(response=>response.blob());
  if (blob.size>5*1024*1024) throw new Error("Each photo must be no larger than 5 MB.");
  const {response,body}=await fetchJSONWithTimeout(`${API_URL}/api/v1/marketplace/chat-images/presign`,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({filename:asset.fileName || "photo.jpg",mime_type:mime,size:blob.size})});
  if (!response.ok || !body.upload_url || !body.key) throw new Error(body.message || "Photo upload is unavailable. Please try again.");
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
  try {
    const uploaded=await fetch(body.upload_url,{method:"PUT",headers:{"Content-Type":mime},body:blob,signal:controller.signal});
    if (!uploaded.ok) throw new Error("Photo upload failed. Please try again.");
    return {key:String(body.key),uri:asset.uri};
  } finally {clearTimeout(timer);}
}

// Retain still-valid signed photo URLs during polling so existing images do
// not download again on every history refresh. Message attachments are immutable.
export function mergeChatMessages<T extends {id:string;created_at:string;media_urls?:string[]}>(current:T[],incoming:T[]):T[] {
  const items=new Map(current.map(item=>[item.id,item]));
  for(const message of incoming) {
    const old=items.get(message.id);
    const valid=(uri:string)=>{
      const stamp=uri.match(/[?&]X-Amz-Date=(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/);
      const expiry=uri.match(/[?&]X-Amz-Expires=(\d+)/);
      return !!stamp && !!expiry && Date.UTC(+stamp[1],+stamp[2]-1,+stamp[3],+stamp[4],+stamp[5],+stamp[6])+(+expiry[1])*1000>Date.now()+90000;
    };
    items.set(message.id,old?.media_urls?.length && old.media_urls.length===message.media_urls?.length && old.media_urls.every(valid) ? {...message,media_urls:old.media_urls} : message);
  }
  return Array.from(items.values()).sort((a,b)=>Date.parse(a.created_at)-Date.parse(b.created_at)||a.id.localeCompare(b.id));
}
