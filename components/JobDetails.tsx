import React,{useState} from 'react';
import {ListingMediaGallery} from './ListingMediaGallery';
import { View, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText as Text } from './ThemeProvider';
import { useAccountDesign } from './AccountDesign';
import { Job, jobDomain, jobPay, jobWorkTypes, jobIsAvailable, jobUnavailableReason } from './jobsApi';
export function JobDetails({ job, preview = false, busy = false, onApply, onReport }: {
    job: Job;
    preview?: boolean;
    busy?: boolean;
    onApply?: () => void;
    onReport?: () => void;
}) {
    const [width,setWidth]=useState(320);
    const c = useAccountDesign(), available = preview || jobIsAvailable(job);
    const applyLabel = job.application_method === 'external' ? 'Apply on external website' : job.application_method === 'email' ? 'Apply by email' : 'Apply in ATL Xpres';
    return <View onLayout={event=>{if(event.nativeEvent.layout.width>0)setWidth(event.nativeEvent.layout.width);}} style={{ gap: 18 }}>{!!job.image_urls?.length&&<ListingMediaGallery images={job.image_urls} imageFit="cover" width={width} height={Math.min(280,width*.65)}/>}<View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}><View style={{ padding: 14, borderRadius: 16, backgroundColor: c.soft }}><Ionicons name="briefcase-outline" size={30} color={c.accent}/></View><View style={{ flex: 1, gap: 4 }}><Text accessibilityRole="header" style={{ fontSize: 24, fontWeight: '800' }}>{job.title || 'Untitled job'}</Text><Text>{job.provider_name || 'Your business'}</Text></View></View>
  {onReport && <Pressable accessibilityRole="button" onPress={onReport} style={s.link}><Text style={{ color: c.accent, textDecorationLine: 'underline' }}>Report job</Text></Pressable>}
  <Text>📍 {[job.city, job.state].filter(Boolean).join(', ') || 'Location not supplied'}</Text><Text>{jobWorkTypes.find(([value]) => value === job.work_type)?.[1] || job.work_type}</Text><Text style={{ fontWeight: '700' }}>{jobPay(job)}</Text><Text>Apply by: {job.deadline ? new Date(job.deadline).toLocaleDateString() : 'Not set'}</Text>{!!job.work_duration && <Text>Work duration: {job.work_duration}</Text>}
  <View style={[s.section, { borderColor: c.line }]}><Text style={s.heading}>About the role</Text><Text style={s.body}>{job.description || 'No description supplied.'}</Text></View><View style={[s.section, { borderColor: c.line }]}><Text style={s.heading}>Requirements</Text><Text style={s.body}>{job.requirements || 'No requirements supplied.'}</Text></View>
  {!!job.application_instructions && <Text style={s.body}>{job.application_instructions}</Text>}
  {!available && <Text accessibilityRole="alert" style={{ color: c.danger, fontWeight: '700' }}>{jobUnavailableReason(job)}</Text>}
  {job.application_method === 'external' && <Text>External destination: {jobDomain(job.application_url) || 'Not available'}. ATL cannot confirm an application submitted outside the app.</Text>}
  {job.application_method === 'email' && <Text>Recruitment address: {job.application_email || 'Not available'}. Sending opens your email app; ATL cannot confirm delivery.</Text>}
  <Pressable accessibilityRole="button" disabled={preview || busy || !available} onPress={onApply} style={[s.apply, { backgroundColor: c.accent, opacity: (preview || busy || !available) ? .5 : 1 }]}><Text style={{ fontWeight: '800', color: c.dark ? '#08251B' : '#FFF' }}>{preview ? 'Preview only' : busy ? 'Checking…' : available ? applyLabel : 'Applications unavailable'}</Text></Pressable>
  <Text style={{ fontSize: 12, color: c.muted }}>Never pay an application fee or send bank passwords. Report suspicious recruitment requests.</Text>
 </View>;
}
const s = StyleSheet.create({ section: { paddingTop: 18, borderTopWidth: 1, gap: 10 }, heading: { fontSize: 18, fontWeight: '700' }, body: { lineHeight: 23, fontSize: 14 }, link: { minHeight: 44, justifyContent: 'center' }, apply: { padding: 16, minHeight: 54, borderRadius: 14, alignItems: 'center' } });
