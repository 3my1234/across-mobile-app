import {ResilientImage} from './ResilientImage';
import {Ionicons} from '@expo/vector-icons';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Pressable, ActivityIndicator, AppState, Linking, Modal } from 'react-native';
import * as Crypto from 'expo-crypto';
import * as Clipboard from 'expo-clipboard';
import { KeyboardScrollView as ScrollView } from './KeyboardScroll';
import { ThemedText as Text, ThemedTextInput as Input } from './ThemeProvider';
import { useAccountDesign } from './AccountDesign';
import { Job, jobWorkTypes, jobsRequest, jobDomain, jobPay, jobMailURL, jobIsAvailable } from './jobsApi';
import { JobDetails } from './JobDetails';
export function JobsScreen({ token, active, onClose, onConversation, initialJobId = '' }: {
    token: string;
    active: boolean;
    onClose: () => void;
    onConversation: (id: string) => void;
    initialJobId?: string;
}) {
    const c = useAccountDesign();
    const [filter,setFilter]=useState<'location'|'work'|null>(null);
    const [items, setItems] = useState<Job[]>([]), [cursor, setCursor] = useState(''), [search, setSearch] = useState(''), [location, setLocation] = useState(''), [work, setWork] = useState(''), [query, setQuery] = useState({ search: '', location: '', work: '' });
    const [job, setJob] = useState<Job | null>(null), [loading, setLoading] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(''), [dialog, setDialog] = useState<'apply' | 'report' | null>(null), [message, setMessage] = useState(''), [report, setReport] = useState('');
    const [now, setNow] = useState(Date.now());
    const live = useRef(true), epoch = useRef(0), flight = useRef(false), application = useRef<{
        job: string;
        id: string;
        message: string;
    } | null>(null), visible = useRef(active);
    visible.current = active;
    useEffect(() => { live.current = true; return () => { live.current = false; epoch.current++; }; }, []);
    useEffect(() => { setJob(null); setItems([]); setMessage(''); setNotice(''); setError(''); application.current = null; }, [token]);
    const load = useCallback(async (next = '') => { if (!visible.current)
        return; const version = ++epoch.current; setLoading(true); try {
        const params = new URLSearchParams({ search: query.search, location: query.location, work_type: query.work, limit: '25' });
        if (next)
            params.set('cursor', next);
        const data = await jobsRequest(token, `/jobs?${params}`);
        if (live.current && version === epoch.current) {
            setItems(old => next ? [...old, ...data.items.filter((j: Job) => !old.some(x => x.id === j.id))] : data.items);
            setCursor(data.next_cursor || '');
        }
    }
    catch (e) {
        if (live.current && version === epoch.current)
            setError(e instanceof Error ? e.message : 'Could not load jobs');
    }
    finally {
        if (live.current && version === epoch.current)
            setLoading(false);
    } }, [token, query]);
    const selectedJob = useRef(job); selectedJob.current=job;
    const open = useCallback(async (id: string, preserveDraft=false) => { const version = ++epoch.current; setLoading(true); setError(''); try {
        const data = await jobsRequest(token, `/jobs/${id}`);
        if (live.current && visible.current && version === epoch.current) {
            setJob(data);
            setDialog(null);
            if(!preserveDraft){setMessage('');setNotice('');application.current=null;}
        }
    }
    catch (e) {
        if (live.current && version === epoch.current)
            setError(e instanceof Error ? e.message : 'Job unavailable');
    }
    finally {
        if (live.current && version === epoch.current)
            setLoading(false);
    } }, [token]);
    useEffect(() => { if (active) {
        if (initialJobId)
            void open(initialJobId,true);
        else if(selectedJob.current) void open(selectedJob.current.id,true);
        else void load();
    }
    else {
        epoch.current++;
        setLoading(false);
        setDialog(null);
    } return () => { epoch.current++; }; }, [active, initialJobId, open, load]);
    useEffect(() => { if (!active)
        return; const sub = AppState.addEventListener('change', state => { if (state === 'active') {
        setDialog(null);
        if (job)
            void open(job.id,true);
        else
            void load();
    } }); const timer = setInterval(() => setNow(Date.now()), 1000); return () => { sub.remove(); clearInterval(timer); }; }, [active, job?.id, load, open]);
    const run = async (action: () => Promise<void>) => { if (flight.current)
        return; flight.current = true; setBusy(true); setError(''); try {
        await action();
    }
    catch (e) {
        if (live.current)
            setError(e instanceof Error ? e.message : 'Request interrupted. Check status before retrying.');
    }
    finally {
        flight.current = false;
        if (live.current)
            setBusy(false);
    } };
    const button = (label: string, action: () => void, disabled = false, primary = false) => <Pressable accessibilityRole="button" disabled={busy || disabled} onPress={action} style={{ padding: 14, minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: c.line, backgroundColor: primary ? c.accent : c.soft, opacity: (busy || disabled) ? .5 : 1 }}><Text style={{ fontWeight: '700', color: primary ? (c.dark ? '#08251B' : '#FFF') : c.accent, textAlign: 'center' }}>{label}</Text></Pressable>;
    const input = (label: string, value: string, set: (v: string) => void, multiline = false, maxLength = 160) => <Input accessibilityLabel={label} placeholder={label} value={value} onChangeText={set} editable={!busy&&!(label==='Message to employer'&&application.current)} multiline={multiline} maxLength={maxLength} style={{ padding: 12, minHeight: multiline ? 110 : 46, borderWidth: 1, borderColor: c.line, borderRadius: 12, textAlignVertical: multiline ? 'top' : 'center' }}/>;
    const confirmed = (receipt: {
        status: string;
        conversation_id?: string;
    }) => { if (receipt.conversation_id && ['received', 'already_received'].includes(receipt.status)) {
        setNotice('Your application message was received.');
        setDialog(null);
        onConversation(receipt.conversation_id);
        return true;
    } return false; };
    const recover = async () => { if (!job)
        return; const result = await jobsRequest(token, `/jobs/${job.id}/application`); if (live.current && visible.current && !confirmed(result))
        setNotice('No application is recorded yet. Your message is retained; you may retry sending it.'); };
    const apply = async (copy = false) => {
        if (!job || !jobIsAvailable(job))
            throw Error('Applications are no longer available. Refresh this job.');
        if (!token)
            throw Error('Sign in to apply.');
        if (job.application_method === 'chat') {
            if (!message.trim())
                throw Error('Enter your application message.');
            if (application.current?.job !== job.id)
                application.current = { job: job.id, id: Crypto.randomUUID(),message };
            try {
                const receipt = await jobsRequest(token, `/jobs/${job.id}/applications`, { method: 'POST', body: JSON.stringify({ id: application.current.id, message:application.current.message, revision: job.revision }) });
                if (live.current && visible.current)
                    confirmed(receipt);
            }
            catch (e) {
                setNotice('Delivery is unconfirmed. Use Check application status before retrying.');
                throw e;
            }
            return;
        }
        const receipt = await jobsRequest(token, `/jobs/${job.id}/clicks`, { method: 'POST', body: JSON.stringify({ id: Crypto.randomUUID(), method: job.application_method, revision: job.revision }) });
        if (!live.current || !visible.current)
            return;
        if (job.application_method === 'external') {
            if (!jobDomain(receipt.application_url) || jobDomain(receipt.application_url) !== jobDomain(job.application_url))
                throw Error('The application destination changed. Reload the job.');
            await Linking.openURL(receipt.application_url);
            setNotice('Website opened. Complete your application there; ATL has not confirmed submission.');
        }
        else {
            if (receipt.application_email !== job.application_email)
                throw Error('The recruitment address changed. Reload the job.');
            if (copy) {
                await Clipboard.setStringAsync(receipt.application_email);
                setNotice('Email address copied. No application has been sent.');
            }
            else {
                await Linking.openURL(jobMailURL(receipt.application_email, receipt.title));
                setNotice('Email app opened. Compose and send there; ATL cannot confirm delivery.');
            }
        }
        setDialog(null);
    };
    return <View style={{ flex: 1, backgroundColor: c.background }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 30 }}>{button(job ? 'Back to jobs' : 'Back to Explore', () => { setError(''); setNotice(''); if (job) {
        setJob(null);
        void load();
    }
    else
        onClose(); })}<Text accessibilityRole="header" style={{ fontSize: 26, fontWeight: '800' }}>Jobs</Text>{!!error && <Text accessibilityRole="alert" style={{ color: c.danger }}>{error}</Text>}{!!notice && <Text accessibilityLiveRegion="polite">{notice}</Text>}{loading && <ActivityIndicator />}
 {job ? <><JobDetails job={job} busy={busy} onApply={() => { setError(''); setDialog('apply'); }} onReport={() => { setReport(''); setDialog('report'); }}/>{button('Refresh job status', () => void open(job.id), loading)}</> : <>{input('Search jobs or employers', search, setSearch)}<View style={{flexDirection:'row',gap:10}}>{button(location||'Location',()=>setFilter(filter==='location'?null:'location'))}{button(jobWorkTypes.find(([v])=>v===work)?.[1]||'Work type',()=>setFilter(filter==='work'?null:'work'))}</View>{filter==='location'&&input('City or state', location, setLocation)}{filter==='work'&&<View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>{[['', 'All work types'], ...jobWorkTypes].map(([value, label]) => <Pressable key={value} onPress={() => setWork(value)} style={{ padding: 10, borderRadius: 10, borderWidth: 1, borderColor: value === work ? c.accent : c.line }}><Text>{label}</Text></Pressable>)}</View>}{button('Search jobs', () => setQuery({ search: search.trim(), location: location.trim(), work }), loading, true)}{!items.length && !loading && <Text>No active jobs match these filters.</Text>}{items.filter(j => !j.deadline || Date.parse(j.deadline) > now).map(item => <Pressable key={item.id} accessibilityRole="button" onPress={() => void open(item.id)} style={{ padding: 12, borderWidth: 1, borderColor: c.line, borderRadius: 18, gap: 12,flexDirection:'row',alignItems:'center' }}>{item.image_urls?.[0]?<ResilientImage uri={item.image_urls[0]} resizeMode="cover" style={{width:88,height:100,borderRadius:12}}/>:<View style={{width:88,height:100,borderRadius:12,backgroundColor:c.soft,alignItems:'center',justifyContent:'center'}}><Ionicons name="briefcase-outline" size={32} color={c.accent}/></View>}<View style={{flex:1,gap:5}}><Text style={{ fontSize: 21, fontWeight: '800' }}>{item.title}</Text><Text>{item.provider_name}</Text><Text>{[item.city, item.state].filter(Boolean).join(', ')} · {jobWorkTypes.find(([v]) => v === item.work_type)?.[1]}</Text><Text style={{ fontWeight: '700' }}>{jobPay(item)}</Text><Text>Apply by {item.deadline ? new Date(item.deadline).toLocaleDateString() : ''}</Text></View></Pressable>)}{!!cursor && button('Load more jobs', () => void load(cursor), loading)}</>}
 </ScrollView><Modal visible={active && !!dialog} transparent animationType="slide" onRequestClose={() => { if (!busy)
        setDialog(null); }}><View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#0008' }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 22, gap: 15, backgroundColor: c.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22 }}>
 {dialog === 'report' ? <><Text style={{ fontSize: 22, fontWeight: '700' }}>Report job</Text>{input('Describe your concern', report, setReport, true, 1000)}{button('Submit report', () => void run(async () => { if (!job)
        return; await jobsRequest(token, `/jobs/${job.id}/reports`, { method: 'POST', body: JSON.stringify({ reason: report }) }); if (live.current) {
        setNotice('Report submitted for moderation.');
        setDialog(null);
    } }), report.trim().length < 3 || !token, true)}</> : job && <><Text style={{ fontSize: 22, fontWeight: '700' }}>{job.application_method === 'external' ? 'Continue to external website?' : job.application_method === 'email' ? 'Apply by email' : 'Your application message'}</Text>{!token&&<Text>Sign in to apply or report a job. Browsing and applying are free.</Text>}{job.application_method === 'external' ? <Text>Destination: {jobDomain(job.application_url)}. Applications are submitted on the external website.</Text> : job.application_method === 'email' ? <><Text>{job.application_email}</Text><Text>{job.application_instructions}</Text><Text>ATL records this as a click, not a received application.</Text></> : input('Message to employer', message, setMessage, true, 1500)}{!!error && <Text accessibilityRole="alert" style={{ color: c.danger }}>{error}</Text>}{!!notice && <Text>{notice}</Text>}{button(job.application_method === 'chat' ? 'Send application message' : job.application_method === 'email' ? 'Open email app' : 'Open website', () => void run(() => apply()), !jobIsAvailable(job) || !token, true)}{job.application_method === 'email' && button('Copy email address', () => void run(() => apply(true)), !jobIsAvailable(job) || !token)}{job.application_method === 'chat' && button('Check application status', () => void run(recover))}</>}
 {button('Cancel', () => setDialog(null))}</ScrollView></View></Modal></View>;
}
