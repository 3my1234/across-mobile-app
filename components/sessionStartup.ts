type StartupPorts={
 read:()=>Promise<[string|null,string|null]>;
 currentToken:()=>string|null;
 open:(token:string)=>void;
 missing:()=>Promise<void>;
 rejected:(token:string)=>Promise<void>;
 validate:(token:string,signal:AbortSignal)=>Promise<{status:number}>;
};

// Secure local restoration is the UI path. Remote validation stays mandatory
// for the API, but a network round trip must not gate cached/public screens.
export function createSessionStartup(ports:StartupPorts){
 let generation=0,controller:AbortController|null=null;
 function cancel(){generation++;controller?.abort();controller=null;}
 async function validate(token:string,version:number){
  const request=new AbortController();controller=request;
  const timer=setTimeout(()=>request.abort(),5000);
  try{const response=await ports.validate(token,request.signal);
   if(version!==generation||ports.currentToken()!==token||request.signal.aborted)return;
   if(response.status===401||response.status===403)await ports.rejected(token);
  }catch{/* Network failures retain the same unexpired local-session fallback. */}
  finally{clearTimeout(timer);if(controller===request)controller=null;}
 }
 async function restore(){
  cancel();const version=generation;let saved:[string|null,string|null];
  try{saved=await ports.read();}catch{if(version===generation)await ports.missing();return;}
  if(version!==generation)return;
  const [token,rawExpiry]=saved,expiry=Number(rawExpiry);
  if(!token?.trim()||!rawExpiry||!Number.isFinite(expiry)||expiry<=0||Date.now()>=expiry*1000){await ports.missing();return;}
  ports.open(token);
  void validate(token,version);
 }
 return {restore,cancel};
}
