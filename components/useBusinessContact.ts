import {useEffect,useRef,useState} from 'react';
import {providerRequest} from './nativeProviderApi';

export function useBusinessContact(token:string|null,providerID?:string) {
 const [state,setState]=useState<{key:string;own:boolean;manage:boolean;error:string}|null>(null),[retry,setRetry]=useState(0);
 const key=`${token || ''}:${providerID || ''}`,sequence=useRef(0);
 useEffect(()=>{
  const version=++sequence.current;
  if(!token||!providerID){setState(null);return;}
  let alive=true;
  void providerRequest(token,`/marketplace/providers/${encodeURIComponent(providerID)}/contact-access`).then(value=>{
   if(typeof value?.own_business!=='boolean'||typeof value?.can_manage!=='boolean')throw Error('Invalid contact access');
   if(alive&&sequence.current===version)setState({key,own:value.own_business,manage:value.own_business&&value.can_manage,error:''});
  }).catch(()=>{if(alive&&sequence.current===version)setState({key,own:false,manage:false,error:'Could not check messaging access. Tap to retry.'});});
  return()=>{alive=false;};
 },[token,providerID,key,retry]);
 const current=state?.key===key?state:null;
 return {own:current?.own||false,canManage:current?.manage||false,error:current?.error||'',checking:!!token&&!!providerID&&!current,retry:()=>{setState(null);setRetry(n=>n+1);}};
}
