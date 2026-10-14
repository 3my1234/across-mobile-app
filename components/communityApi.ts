import { API_URL } from "./config";
import { fetchWithTimeout } from "./utils";
export async function communityRequest(token: string, path: string, options: RequestInit = {}) {
    const response = await fetchWithTimeout(`${API_URL}/api/v1${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options.headers } });
    if (response.status === 304)
        return { data: null, etag: response.headers.get("ETag") || "", unchanged: true };
    const raw=await response.text();let data:any;try{data=raw?JSON.parse(raw):{}}catch{data={message:response.status>=400&&response.status<500&&raw.length<250?raw:"Could not load community. Please retry."}}
    if (!response.ok)
        throw new Error(data.message || (response.status === 401 ? "Sign in again to continue" : "Could not load community. Please retry."));
    return { data, etag: response.headers.get("ETag") || "", unchanged: false };
}
export function communityInviteUsername(url: string): string {
    return url.match(/(?:across:\/\/friend\/|\/community\/invite\/)([a-z][a-z0-9_]{2,35})(?:[/?#]|$)/)?.[1] || "";
}
