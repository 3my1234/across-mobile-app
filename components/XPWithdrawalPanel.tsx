import React, { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import * as Crypto from "expo-crypto";
import { ThemedText as Text, ThemedTextInput as TextInput, useThemedStyles } from "./ThemeProvider";
import { API_URL } from "./config";
import { fetchJSONWithTimeout, money } from "./utils";

type Withdrawal = {id:string; points:number; status:string; bank_name:string; account_number:string; admin_note:string};
export function XPWithdrawalPanel({token,balance,onRefresh}:{token:string;balance:number;onRefresh:()=>Promise<void>}) {
 const s=useThemedStyles(styles);
 const [items,setItems]=useState<Withdrawal[]>([]),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 const [bank,setBank]=useState(""),[number,setNumber]=useState(""),[name,setName]=useState(""),[points,setPoints]=useState("1000");
 const [form,setForm]=useState(false),[message,setMessage]=useState("");
 const requestKey=useRef(""); const active=useRef(true);
 async function load(){
  try { const {response,body}=await fetchJSONWithTimeout(`${API_URL}/api/v1/xp/withdrawals`,{headers:{Authorization:`Bearer ${token}`}});
   if(!active.current)return;if(!response.ok)throw new Error(body.message||"Could not load withdrawal history");setItems(body.items||[]);setError("");
  }catch(e){if(active.current)setError(e instanceof Error?e.message:"Please retry");}
 }
 useEffect(()=>{active.current=true;void load();return()=>{active.current=false;};},[token]); // eslint-disable-line react-hooks/exhaustive-deps
 async function submit(){
  if(busy)return;
  const amount=Number(points);
  if(!Number.isInteger(amount)||amount<1000||amount>balance||!/^\d{10}$/.test(number)||bank.trim().length<2||name.trim().length<2){setError("Enter at least 1,000 available XP, your bank, account name and 10-digit account number.");return;}
  setBusy(true);setError("");if(!requestKey.current)requestKey.current=Crypto.randomUUID();
  try {const {response,body}=await fetchJSONWithTimeout(`${API_URL}/api/v1/xp/withdrawals`,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({request_key:requestKey.current,points:amount,bank_name:bank.trim(),account_number:number,account_name:name.trim()})});
   if(!active.current)return;if(!response.ok)throw new Error(body.message||"Could not save your request");
   requestKey.current="";setForm(false);setMessage("Request saved. Your points are reserved while an admin checks your bank details and arranges payment.");
   await Promise.all([load(),onRefresh()]);
  }catch(e){if(active.current)setError(e instanceof Error?e.message:"Please retry. Your request will not be duplicated.");}finally{if(active.current)setBusy(false);}
 }
 const pending=items.some(item=>item.status==="pending"||item.status==="processing");
 return <View style={s.box}>
  <Text style={s.title}>Withdraw XP</Text><Text style={s.body}>1,000 XP = NGN 1,000. Minimum withdrawal: 1,000 XP. Existing points count too. Payment is reviewed by an admin; it is not instant.</Text>
  {!!message&&<Text accessibilityRole="alert" style={s.body}>{message}</Text>}
  {!!error&&<View><Text accessibilityRole="alert" style={s.body}>{error}</Text><Pressable onPress={()=>void load()}><Text style={s.title}>Retry history</Text></Pressable></View>}
  {!form&&<Pressable disabled={balance<1000||pending} onPress={()=>setForm(true)} style={[s.button,(balance<1000||pending)&&{opacity:.5}]}><Text style={s.buttonText}>{pending?"Withdrawal being reviewed":balance<1000?`${1000-balance} more XP needed`:"Request withdrawal"}</Text></Pressable>}
  {form&&<View style={{gap:10}}>
   <Text style={s.body}>XP to withdraw</Text><TextInput accessibilityLabel="XP to withdraw" value={points} onChangeText={setPoints} keyboardType="number-pad" style={s.input} editable={!busy}/>
   <Text style={s.body}>Your bank name</Text><TextInput accessibilityLabel="Bank name" value={bank} onChangeText={setBank} style={s.input} editable={!busy}/>
   <Text style={s.body}>10-digit account number</Text><TextInput accessibilityLabel="Account number" value={number} onChangeText={setNumber} keyboardType="number-pad" maxLength={10} style={s.input} editable={!busy}/>
   <Text style={s.body}>Name on your bank account</Text><TextInput accessibilityLabel="Account name" value={name} onChangeText={setName} style={s.input} editable={!busy}/>
   <Pressable disabled={busy} onPress={()=>void submit()} style={s.button}><Text style={s.buttonText}>{busy?"Saving request...":"Submit for review"}</Text></Pressable>
   <Pressable disabled={busy} onPress={()=>setForm(false)}><Text style={s.body}>Cancel</Text></Pressable>
  </View>}
  {items.map(item=><View key={item.id} style={s.history}><Text style={s.title}>{money(item.points,"NGN")} · {item.status}</Text><Text style={s.body}>{item.bank_name} · ending {item.account_number.slice(-4)}</Text>{!!item.admin_note&&<Text style={s.body}>{item.admin_note}</Text>}</View>)}
 </View>;
}
const styles={box:{gap:12,marginTop:16},title:{fontSize:14,fontWeight:"700" as const,color:"#191919"},body:{fontSize:13,lineHeight:19,color:"#66736F"},input:{borderWidth:1,borderColor:"#D0D5DD",borderRadius:8,padding:12,color:"#191919",backgroundColor:"#FFFFFF"},button:{backgroundColor:"#FF4747",padding:13,borderRadius:10,alignItems:"center" as const},buttonText:{color:"#FFFFFF",fontWeight:"700" as const},history:{borderTopWidth:1,borderColor:"#D0D5DD",paddingTop:10}};
