import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import {gcm} from '@noble/ciphers/aes';
import {bytesToHex,hexToBytes,utf8ToBytes,bytesToUtf8} from '@noble/ciphers/utils';
type Entry={saved:number;value:any};
type Session={closed:boolean;id:string;entries:Record<string,Entry>;key:Uint8Array;chain:Promise<void>};
const sessions=new Map<string,Promise<Session>>(),closed=new Set<string>(),TTL=7*86400000;
async function session(actor:string){if(!sessions.has(actor))sessions.set(actor,(async()=>{
 const id='atl.chat.'+await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,actor);
 let keyHex=await SecureStore.getItemAsync(id);if(!keyHex){keyHex=bytesToHex(Crypto.getRandomBytes(32));await SecureStore.setItemAsync(id,keyHex,{keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY});}
 const key=hexToBytes(keyHex),state:Session={closed:closed.has(actor),id,key,entries:{},chain:Promise.resolve()};
 const raw=await AsyncStorage.getItem(id);if(raw)try{const record=JSON.parse(raw);state.entries=JSON.parse(bytesToUtf8(gcm(key,hexToBytes(record.nonce)).decrypt(hexToBytes(record.data))));}catch{/* Ignore corrupt snapshots; fetch from the server. */}return state;
 })().catch(error=>{sessions.delete(actor);throw error;}));return sessions.get(actor)!;}
export const privateChatStore={
 async get(actor:string,id:string){try{const s=await session(actor);const entry=!s.closed&&s.entries[id];return entry&&Date.now()-entry.saved<TTL?entry.value:null;}catch{return null;}},
 put(actor:string,id:string,value:any){void session(actor).then(s=>{if(s.closed||closed.has(actor))return;s.chain=s.chain.then(async()=>{if(s.closed||closed.has(actor))return;s.entries[id]={saved:Date.now(),value};const keys=Object.keys(s.entries).sort((a,b)=>s.entries[a].saved-s.entries[b].saved);while(keys.length>12||JSON.stringify(s.entries).length>256000)delete s.entries[keys.shift()!];const nonce=Crypto.getRandomBytes(12),data=gcm(s.key,nonce).encrypt(utf8ToBytes(JSON.stringify(s.entries)));if(!s.closed&&!closed.has(actor))await AsyncStorage.setItem(s.id,JSON.stringify({nonce:bytesToHex(nonce),data:bytesToHex(data)}));}).catch(()=>{});}).catch(()=>{});},
 async clear(actor:string,retire=true){closed.add(actor);try{const s=await session(actor);s.closed=true;await s.chain;await Promise.all([AsyncStorage.removeItem(s.id),SecureStore.deleteItemAsync(s.id)]);s.entries={};s.key.fill(0);}catch{/* Logout still succeeds. */}finally{if(!retire){sessions.delete(actor);closed.delete(actor);}}}
};
