import AsyncStorage from '@react-native-async-storage/async-storage';
const prefix='atl:provider-listing-draft:v1:';let writes=Promise.resolve();
export type SavedListingDraft={draft:Record<string,any>;numericText:Record<string,string>;at:number};
const key=(provider:string,kind:string)=>prefix+provider+':'+kind;
export function saveListingDraft(provider:string,kind:string,value:SavedListingDraft){
 const raw=JSON.stringify(value);if(raw.length>250000)return Promise.reject(Error('This draft is too large to save on this phone. Save it to your account.'));
 return writes=writes.catch(()=>{}).then(()=>AsyncStorage.setItem(key(provider,kind),raw));
}
export function clearListingDraft(provider:string,kind:string){return writes=writes.catch(()=>{}).then(()=>AsyncStorage.removeItem(key(provider,kind)));}
export async function readListingDraft(provider:string,kind:string):Promise<SavedListingDraft|null>{
 await writes.catch(()=>{});const raw=await AsyncStorage.getItem(key(provider,kind));if(!raw)return null;
 try{const value=JSON.parse(raw);if(!value.draft||!value.numericText||!Number.isFinite(value.at)||Date.now()-value.at>7*86400000)return null;return value;}catch{return null;}
}
