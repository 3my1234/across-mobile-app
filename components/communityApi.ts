import { API_URL, AUTH_TIMEOUT_MS } from "./config";
export async function communityRequest(token: string, path: string, options: RequestInit = {}) {
    const controller=new AbortController();let timer:ReturnType<typeof setTimeout>;
    const deadline=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{reject(new Error('The server took too long to respond. Please retry.'));controller.abort();},Number.isFinite(AUTH_TIMEOUT_MS)?Math.min(15000,Math.max(1000,AUTH_TIMEOUT_MS)):12000);});
    try{return await Promise.race([deadline,(async()=>{
    const response = await fetch(`${API_URL}/api/v1${path}`, { ...options, signal:controller.signal, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options.headers } });
    if (response.status === 304)
        return { data: null, etag: response.headers.get("ETag") || "", unchanged: true };
    const raw=await response.text();let data:any;try{data=raw?JSON.parse(raw):{}}catch{if(response.ok)throw new Error('The server returned an incomplete response. Please retry.');data={message:response.status>=400&&response.status<500&&raw.length<250?raw:"Could not load community. Please retry."}}
    if (!response.ok)
        throw new Error(data.message || (response.status === 401 ? "Sign in again to continue" : "Could not load community. Please retry."));
    return { data, etag: response.headers.get("ETag") || "", unchanged: false };
    })()]);}finally{clearTimeout(timer!);}
}
export function communityInviteUsername(url: string): string {
    return url.match(/(?:across:\/\/friend\/|\/community\/invite\/)([a-z][a-z0-9_]{2,35})(?:[/?#]|$)/)?.[1] || "";
}
