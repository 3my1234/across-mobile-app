import { API_URL, AUTH_TIMEOUT_MS } from "./config";
export class CommunityRequestError extends Error {
    constructor(message:string,public status:number,public requestID:string,public retryAfterSeconds?:number){super(message);this.name='CommunityRequestError';}
}
// Mutations remain explicit user actions: never replay a POST automatically.
// Remember bounded server cooldowns for both manual sends and automatic reads.
const requestCooldowns=new Map<string,{until:number;error:CommunityRequestError}>();
export async function communityRequest(token: string, path: string, options: RequestInit = {}) {
    const method=(options.method||'GET').toUpperCase(),mutation=method==='POST',read=method==='GET';
    const cooldownKey=token+'\n'+method+'\n'+(read?path.split('?')[0]:path);
    const now=Date.now();for(const [key,value] of requestCooldowns)if(value.until<=now)requestCooldowns.delete(key);
    const cooldown=mutation||read?requestCooldowns.get(cooldownKey):undefined;
    if(cooldown&&cooldown.until>now)throw cooldown.error;
    const controller=new AbortController();let timer:ReturnType<typeof setTimeout>;
    const deadline=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{reject(new Error('The server took too long to respond. Please retry.'));controller.abort();},Number.isFinite(AUTH_TIMEOUT_MS)?Math.min(15000,Math.max(1000,AUTH_TIMEOUT_MS)):12000);});
    try{return await Promise.race([deadline,(async()=>{
    const response = await fetch(`${API_URL}/api/v1${path}`, { ...options, signal:controller.signal, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options.headers } });
    if (response.status === 304)
        return { data: null, etag: response.headers.get("ETag") || "", unchanged: true };
    const raw=await response.text();let data:any;try{data=raw?JSON.parse(raw):{}}catch{if(response.ok)throw new Error('The server returned an incomplete response. Please retry.');data={message:response.status>=400&&response.status<500&&raw.length<250&&!raw.includes('<')?raw:''}}
    if (!response.ok){
        const retryHeader=Number(response.headers.get('Retry-After'));
        const retryAfter=[429,503].includes(response.status)&&Number.isFinite(retryHeader)&&retryHeader>0?Math.min(3600,Math.ceil(retryHeader)):undefined;
        const fallback=response.status===401?'Sign in again to continue.':response.status===429?'Too many requests. Please wait before trying again.':options.method==='POST'?'Your message could not be sent. Please try again.':'Messages could not be loaded. Please try again.';
        const supplied=[data?.message,data?.error].find(value=>typeof value==='string'&&value.trim().length>0&&value.length<=500);
        const message=(supplied||fallback)+(retryAfter?` Try again in ${retryAfter} seconds.`:'');
        const error=new CommunityRequestError(message,response.status,response.headers.get('X-Request-ID')||'',retryAfter);
        if((mutation||read)&&retryAfter){
            if(requestCooldowns.size>=64&&!requestCooldowns.has(cooldownKey))requestCooldowns.delete(requestCooldowns.keys().next().value!);
            requestCooldowns.set(cooldownKey,{until:Date.now()+retryAfter*1000+(read?Math.floor(Math.random()*501):0),error});
        }
        throw error;
    }
    return { data, etag: response.headers.get("ETag") || "", unchanged: false };
    })()]);}finally{clearTimeout(timer!);}
}
export function communityInviteUsername(url: string): string {
    return url.match(/(?:across:\/\/friend\/|\/community\/invite\/)([a-z][a-z0-9_]{2,35})(?:[/?#]|$)/)?.[1] || "";
}
