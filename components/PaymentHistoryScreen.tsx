import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { API_URL } from "./config";
import { fetchWithTimeout, money } from "./utils";

type Payment = { id: string; order_id: string; reference: string; provider: string; amount: number; charged_amount: number | null; currency: string; created_at: string; paid_at: string | null; payment_status: string; refund_status: string; chargeback_status: string; seller_settlement_status: string; service_fee: number; delivery_fee: number; xp_discount: number };
type Props = { token: string; bottomInset: number; onBack: () => void; onViewOrders: () => void; onConfirmed: (orderId: string) => Promise<void> };
export function PaymentHistoryScreen({ token, bottomInset, onBack, onViewOrders, onConfirmed }: Props) {
  const [payments,setPayments]=useState<Payment[]>([]);
  const [cursor,setCursor]=useState("");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [checking,setChecking]=useState("");
  const generation=useRef(0);
  const verificationGeneration=useRef(0);
  const rows=useRef<Payment[]>([]);
  const nextCursor=useRef("");
  const initialized=useRef(false);
  const inFlight=useRef(false);
  const active=useRef(true);
  const load=useCallback(async (older=false) => {
    if(inFlight.current || !active.current) return;
    inFlight.current=true; const request=++generation.current;
    setLoading(true);
    try {
      const response=await fetchWithTimeout(`${API_URL}/api/v1/payments/history?limit=20${older && nextCursor.current ? `&cursor=${encodeURIComponent(nextCursor.current)}` : ""}`,{cache:"no-store",headers:{Authorization:`Bearer ${token}`}});
      const body=await response.json();
      if(request!==generation.current || !active.current) return;
      if(!response.ok) throw new Error(body.message || "Could not load payment history. Tap Retry.");
      const merged=new Map(rows.current.map(item=>[item.id,item]));
      for(const item of body.payments || []) merged.set(item.id,item);
      rows.current=Array.from(merged.values()).sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)||b.id.localeCompare(a.id));
      setPayments(rows.current);
      if(older || !initialized.current) {nextCursor.current=body.next_cursor || "";setCursor(nextCursor.current);}
      initialized.current=true;
      setError("");
    } catch(e) {if(request===generation.current && active.current) setError(e instanceof Error?e.message:"Could not load payment history. Tap Retry.");}
    finally {if(request===generation.current && active.current) {inFlight.current=false;setLoading(false);}}
  },[token]);
  useEffect(()=>{
    const requests=generation; const verifications=verificationGeneration;
    active.current=true; void load();
    const timer=setInterval(()=>{if(AppState.currentState==="active") void load();},12000);
    const listener=AppState.addEventListener("change",state=>{if(state==="active") void load();});
    return ()=>{active.current=false;requests.current++;verifications.current++;inFlight.current=false;clearInterval(timer);listener.remove();};
  },[load]);
  const verify=async (payment: Payment)=>{
    if(checking) return; setChecking(payment.id);setError("");
    const request=++verificationGeneration.current;
    try {
      const response=await fetchWithTimeout(`${API_URL}/api/v1/payments/flutterwave/verify`,{method:"POST",cache:"no-store",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({order_id:payment.order_id,tx_ref:payment.reference})});
      const body=await response.json();
      if(!active.current || request!==verificationGeneration.current) return;
      if(!response.ok) throw new Error("Could not finish confirming this payment. Do not pay again; retry or contact support with the reference below.");
      if(body.payment_state==="settled") {await onConfirmed(payment.order_id);await load();}
      else setError("This payment is not confirmed yet. If your bank was debited, do not pay again; check later or contact support.");
    } catch(e) {if(active.current) setError(e instanceof Error?e.message:"Could not check payment. Do not pay again; retry or contact support.");}
    finally {if(active.current) setChecking("");}
  };
  return <View style={styles.screen}>
    <View style={styles.header}><Pressable onPress={onBack} style={styles.button}><Text style={styles.action}>Back</Text></Pressable><Text style={styles.title}>Payment history</Text></View>
    {!!error && <Pressable onPress={()=>void load()}><Text style={styles.error}>{error} Tap to retry history.</Text></Pressable>}
    <FlatList data={payments} keyExtractor={item=>item.id} refreshing={loading} onRefresh={()=>void load()} contentContainerStyle={{padding:12,paddingBottom:bottomInset+16,flexGrow:1}}
      ListHeaderComponent={<Text style={styles.note}>{"Order payments and checkout attempts. Payment confirmation and the seller's bank payout are separate."}</Text>}
      ListEmptyComponent={loading?<ActivityIndicator color="#FF4747"/>:!error?<Text style={styles.note}>No payment records yet.</Text>:null}
      ListFooterComponent={cursor?<Pressable disabled={loading} style={styles.button} onPress={()=>void load(true)}><Text style={styles.action}>{loading?"Loading...":"Load older payments"}</Text></Pressable>:null}
      renderItem={({item})=><View style={styles.card}>
        <Text style={styles.amount}>{money(item.charged_amount && item.charged_amount>0?item.charged_amount:item.amount,item.currency)}</Text>
        <Text style={styles.status}>{item.payment_status==="succeeded"?"Payment confirmed":item.payment_status==="failed"?"Checkout attempt failed":item.payment_status==="cancelled"?"Checkout cancelled":"Awaiting payment confirmation"}</Text>
        <Text style={styles.note}>{new Date(item.paid_at || item.created_at).toLocaleString()} - {item.provider}</Text>
        <Text style={styles.detail}>Order amount: {money(item.amount,item.currency)}</Text>
        {item.charged_amount!==null && item.charged_amount>0 && <Text style={styles.detail}>Gateway charged amount: {money(item.charged_amount,item.currency)}</Text>}
        <Text style={styles.detail}>Service fee after XP: {money(item.service_fee,item.currency)}</Text>
        {!!item.xp_discount && <Text style={styles.detail}>XP discount: {item.xp_discount} XP ({item.payment_status==="succeeded"?"used":"reserved until confirmation"})</Text>}
        <Text style={styles.detail}>Delivery: {money(item.delivery_fee,item.currency)}</Text>
        {item.payment_status==="succeeded" && <Text style={styles.note}>Seller payout: {item.seller_settlement_status.replace(/_/g," ")}</Text>}
        {item.refund_status!=="none" && <Text style={styles.detail}>Refund: {item.refund_status}</Text>}
        {item.chargeback_status!=="none" && <Text style={styles.detail}>Payment dispute: {item.chargeback_status}</Text>}
        <Text selectable style={styles.reference}>Reference: {item.reference}</Text><Text selectable style={styles.reference}>Order: {item.order_id}</Text>
        {item.payment_status==="succeeded"?<Pressable onPress={onViewOrders} style={styles.button}><Text style={styles.action}>View orders in Track</Text></Pressable>:<Pressable disabled={!!checking} onPress={()=>void verify(item)} style={styles.button}><Text style={styles.action}>{checking===item.id?"Checking...":"Check payment - no new charge"}</Text></Pressable>}
      </View>}/>
  </View>;
}
const styles=StyleSheet.create({screen:{flex:1,backgroundColor:"#F7F8F8"},header:{flexDirection:"row",alignItems:"center",gap:12,padding:12,backgroundColor:"#FFF"},title:{fontSize:18,fontWeight:"800",color:"#191919"},card:{padding:16,marginTop:12,backgroundColor:"#FFF",borderRadius:14},amount:{fontSize:22,fontWeight:"800",color:"#191919"},status:{marginTop:4,fontWeight:"700",color:"#30423D"},note:{fontSize:12,lineHeight:18,color:"#66736F",marginVertical:6},detail:{fontSize:13,color:"#30423D",marginTop:4},reference:{fontSize:11,lineHeight:17,color:"#66736F",marginTop:6},button:{padding:12,minHeight:44},action:{fontWeight:"700",color:"#D72736"},error:{padding:12,color:"#B42318"}});
