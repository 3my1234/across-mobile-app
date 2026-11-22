import {fetchJSONWithTimeout} from './utils';

// The public website serves this small file independently of the app build.
// A missing or temporarily unavailable file preserves the current behaviour.
let cached:{at:number;enabled:boolean}|null=null;
let flight:Promise<boolean>|null=null;
export function customerEntryEnabled():Promise<boolean>{
 if(cached&&Date.now()-cached.at<60000)return Promise.resolve(cached.enabled);
 if(flight)return flight;
 flight=(async()=>{
  try{
   const {response,body}=await fetchJSONWithTimeout('https://atlxpres.com/customer-entry-config.json',{cache:'no-store'},3000);
   if(response.ok&&typeof body?.sponsored_entry_enabled==='boolean'){
    cached={at:Date.now(),enabled:body.sponsored_entry_enabled};return cached.enabled;
   }
  }catch{/* The Home button remains available if configuration cannot be read. */}
  return true;
 })().finally(()=>{flight=null;});
 return flight;
}
