import React,{useState} from 'react';
import {Pressable,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {ThemedText as Text} from './ThemeProvider';
import {useAccountDesign} from './AccountDesign';
import {identityVerificationDocument,latestVerificationDocument,verificationChecklist,verificationDocumentStatus,verificationKinds,VerificationDocument} from './nativeProviderPolicy';

export function ProviderVerificationDocuments({driver,documents,busy,onSelect,onView}:{driver:boolean;documents:VerificationDocument[];busy:boolean;onSelect:(kind:string)=>void;onView:(id:string)=>void}) {
 const c=useAccountDesign(),[history,setHistory]=useState(false),rows=verificationChecklist(driver),identity=identityVerificationDocument(documents);
 const submitted=rows.filter(row=>verificationDocumentStatus(latestVerificationDocument(documents,row.kind),row.kind).submitted).length;
 const chip=(document:VerificationDocument|undefined,kind:string)=>{
  const status=verificationDocumentStatus(document,kind);
  const color=status.tone==='success'?c.accent:status.tone==='pending'?(c.dark?'#FFE08A':'#795600'):c.danger;
  return <Text style={{fontSize:11,color,backgroundColor:status.tone==='pending'?(c.dark?'#493B12':'#FFF1BE'):c.soft,paddingHorizontal:7,paddingVertical:4,borderRadius:7}}>{status.label}</Text>;
 };
 const action=(label:string,onPress:()=>void,accessibilityLabel=label)=><Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} disabled={busy} onPress={onPress} style={{padding:9,minHeight:44,justifyContent:'center'}}><Text style={{fontWeight:'700',color:c.accent}}>{label}</Text></Pressable>;
 return <View style={{gap:14}}>
  {driver&&<View style={{gap:8}}><Text style={{fontSize:18,fontWeight:'700'}}>{submitted} of {rows.length} required documents submitted</Text><View accessibilityRole="progressbar" accessibilityValue={{min:0,max:rows.length,now:submitted}} style={{height:9,borderRadius:6,backgroundColor:c.line,overflow:'hidden'}}><View style={{height:9,width:`${submitted/rows.length*100}%`,backgroundColor:c.accent}}/></View><Text style={{fontSize:12,color:c.muted}}>Documents must be approved before driving services go live. Your licence counts as ID; a second ID upload is not required.</Text></View>}
  {!driver&&<View style={{borderWidth:1,borderColor:c.line,borderRadius:16,padding:16,gap:12}}>
   <View style={{flexDirection:'row',gap:10,alignItems:'center'}}><Ionicons name="document-text-outline" size={28} color={c.accent}/><Text style={{flex:1,fontSize:18,fontWeight:'700'}}>Government-issued ID</Text>{chip(identity,identity?.document_type||'government_id')}</View>
   <Text>{rows[0].help}</Text>
   <Pressable accessibilityRole="button" accessibilityLabel="Upload ID" disabled={busy} onPress={()=>onSelect('government_id')} style={{backgroundColor:c.accent,borderRadius:12,padding:15,alignItems:'center'}}><Text style={{color:c.dark?'#08261D':'#FFFFFF',fontWeight:'700'}}>Upload ID</Text></Pressable>
   {!!identity&&action('View submitted ID',()=>onView(identity.id))}
   <Text style={{fontSize:12,color:c.muted}}>Visible only to authorized reviewers.</Text>
  </View>}
  {driver&&['Identity','Vehicle'].map(group=><View key={group} style={{gap:8}}><Text style={{fontSize:16,fontWeight:'700'}}>{group}</Text><View style={{borderWidth:1,borderColor:c.line,borderRadius:14,overflow:'hidden'}}>{rows.filter(row=>row.group===group).map((row,index)=>{
   const document=latestVerificationDocument(documents,row.kind),status=verificationDocumentStatus(document,row.kind);
   return <View key={row.kind} style={{padding:10,gap:5,borderTopWidth:index?1:0,borderColor:c.line}}>
    <View style={{flexDirection:'row',alignItems:'center',gap:8}}><Ionicons name={row.icon as React.ComponentProps<typeof Ionicons>['name']} size={21} color={c.accent}/><Text style={{flex:1,fontWeight:'600'}}>{row.label}</Text>{chip(document,row.kind)}</View>
    <Text style={{fontSize:12,color:c.muted}}>{row.help}</Text>
    {!!document?.review_notes&&<Text style={{fontSize:12,color:c.danger}}>{document.review_notes}</Text>}
    <View style={{flexDirection:'row',justifyContent:'flex-end'}}>{document&&action('View',()=>onView(document.id),`View ${row.label}`)}{action(document?(status.submitted?'Update':'Replace'):'Upload',()=>onSelect(row.kind),`${document?'Replace':'Upload'} ${row.label}`)}</View>
   </View>;
  })}</View></View>)}
  {action(history?'Hide submission history':'Submission history',()=>setHistory(value=>!value))}
  {history&&<View style={{gap:8}}>{!documents.length&&<Text>No documents submitted yet.</Text>}{documents.map(document=><View key={document.id} style={{borderWidth:1,borderColor:c.line,borderRadius:12,padding:10,gap:5}}><Text style={{fontWeight:'600'}}>{verificationKinds.find(([kind])=>kind===document.document_type)?.[1]||document.document_type}</Text>{chip(document,document.document_type)}{!!document.expires_on&&<Text>Expires {document.expires_on}</Text>}{!!document.review_notes&&<Text>{document.review_notes}</Text>}{!rows.some(row=>row.kind===document.document_type)&&<Text style={{fontSize:12,color:c.muted}}>Previous submission. Not an additional requirement for this checklist.</Text>}{action('View submitted document',()=>onView(document.id),`View submission ${document.id}`)}</View>)}</View>}
 </View>;
}
