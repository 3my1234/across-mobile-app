import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Pressable, Alert, ActivityIndicator, AppState } from 'react-native';
import * as Crypto from 'expo-crypto';
import { KeyboardScrollView as ScrollView } from './KeyboardScroll';
import { ThemedText as Text, ThemedTextInput as Input } from './ThemeProvider';
import { useAccountDesign } from './AccountDesign';
import { Job, jobWorkTypes, jobsRequest, newJob, jobDeadlineInput, jobDeadlineISO } from './jobsApi';
import { JobDetails } from './JobDetails';
type Allowance = {
    limit: number;
    used: number;
    remaining: number;
    verified: boolean;
    note: string;
};
export function NativeProviderJobs({ token, onClose, onNavigationGuard }: {
    token: string;
    onClose: () => void;
    onNavigationGuard?: (guard: ((action: () => void) => void) | null) => void;
}) {
    const c = useAccountDesign();
    const [items, setItems] = useState<Job[]>([]), [cursor, setCursor] = useState(''), [tab, setTab] = useState('published'), [limits, setLimits] = useState<Allowance | null>(null);
    const [draft, setDraft] = useState<Job | null>(null), [step, setStep] = useState(0), [deadline, setDeadline] = useState(''), [min, setMin] = useState(''), [max, setMax] = useState(''), [dirty, setDirty] = useState(false);
    const [busy, setBusy] = useState(false), [loading, setLoading] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
    const live = useRef(true), epoch = useRef(0), mutation = useRef(false);
    useEffect(() => { live.current = true; return () => { live.current = false; epoch.current++; }; }, []);
    const load = useCallback(async (next = '') => { const version = ++epoch.current; setLoading(true); try {
        const [data, allowance] = await Promise.all([jobsRequest(token, `/providers/me/jobs?status=${tab}&limit=25${next ? `&cursor=${encodeURIComponent(next)}` : ''}`), jobsRequest(token, '/providers/me/jobs/allowance')]);
        if (live.current && version === epoch.current) {
            setItems(old => next ? [...old, ...data.items.filter((j: Job) => !old.some(x => x.id === j.id))] : data.items);
            setCursor(data.next_cursor || '');
            setLimits(allowance);
        }
    }
    catch (e) {
        if (live.current && version === epoch.current)
            setError(e instanceof Error ? e.message : 'Could not load jobs');
    }
    finally {
        if (live.current && version === epoch.current)
            setLoading(false);
    } }, [token, tab]);
    useEffect(() => { void load(); return () => { epoch.current++; }; }, [load]);
    useEffect(() => { const sub = AppState.addEventListener('change', state => { if (state === 'active')
        void load(); }); return () => sub.remove(); }, [load]);
    useEffect(() => { onNavigationGuard?.(action => { if (mutation.current)
        return; if (dirty)
        Alert.alert('Unsaved job changes', 'Save your draft before leaving, or discard these changes.', [{ text: 'Keep editing', style: 'cancel' }, { text: 'Discard changes', style: 'destructive', onPress: action }]);
    else
        action(); }); return () => onNavigationGuard?.(null); }, [dirty, onNavigationGuard]);
    const edit = (job: Job) => { setDraft(job); setStep(0); setDeadline(jobDeadlineInput(job.deadline)); setMin(job.pay_min == null ? '' : String(job.pay_min)); setMax(job.pay_max == null ? '' : String(job.pay_max)); setDirty(false); setError(''); setNotice(''); };
    const patch = (key: keyof Job, value: unknown) => { setDraft(old => old ? { ...old, [key]: value } : old); setDirty(true); };
    const run = async (action: () => Promise<void>) => { if (mutation.current)
        return; mutation.current = true; setBusy(true); setError(''); setNotice(''); try {
        await action();
    }
    catch (e) {
        if (live.current)
            setError(e instanceof Error ? e.message : 'Could not complete this action. Refresh before retrying.');
    }
    finally {
        mutation.current = false;
        if (live.current)
            setBusy(false);
    } };
    const recover = async (id: string) => { const saved = await jobsRequest(token, `/providers/me/jobs/${id}`); if (live.current) {
        edit(saved);
        setNotice('Loaded the server copy. Check it before saving or publishing again.');
    } return saved as Job; };
    const save = async () => {
        if (!draft)
            throw Error('Choose a job first.');
        const amount = (value: string) => { if (!value.trim())
            return null; if (!/^\d+(\.\d{1,2})?$/.test(value.trim()))
            throw Error('Enter pay using numbers with up to two decimal places.'); return Number(value); };
        const payload = { ...draft, deadline: deadline.trim() ? jobDeadlineISO(deadline.trim()) : null, pay_min: amount(min), pay_max: amount(max) };
        try {
            const saved = await jobsRequest(token, `/providers/me/jobs${draft.revision ? `/${draft.id}` : ''}`, { method: draft.revision ? 'PUT' : 'POST', body: JSON.stringify(payload) });
            if (live.current) {
                setDraft(saved);
                setDirty(false);
                setNotice('Draft saved. Review the preview before publishing.');
            }
            await load();
            return saved as Job;
        }
        catch (e) {
            setNotice('If the connection interrupted, load the server copy before retrying. Your job reference is unchanged.');
            throw e;
        }
    };
    const transition = async (status: string) => { if (!draft)
        return; if (dirty)
        throw Error('Save your changes before changing job status.'); const result = await jobsRequest(token, `/providers/me/jobs/${draft.id}/status`, { method: 'POST', body: JSON.stringify({ status, revision: draft.revision }) }); if (live.current) {
        setDraft(result);
        setNotice(status === 'published' ? 'Job published. It uses one of your active job places; product and service places are unchanged.' : 'Status updated; the listing remains in your history.');
    } await load(); };
    const button = (label: string, action: () => void, disabled = false, primary = false) => <Pressable accessibilityRole="button" disabled={busy || disabled} onPress={action} style={{ padding: 13, minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: c.line, backgroundColor: primary ? c.accent : c.soft, opacity: (busy || disabled) ? .5 : 1 }}><Text style={{ fontWeight: '700', color: primary ? (c.dark ? '#08251B' : '#FFF') : c.accent, textAlign: 'center' }}>{label}</Text></Pressable>;
    const field = (label: string, value: string, onChange: (text: string) => void, multiline = false, maxLength = 1000) => <View style={{ gap: 6 }}><Text style={{ fontWeight: '700' }}>{label}</Text><Input accessibilityLabel={label} value={value} onChangeText={onChange} editable={!busy} multiline={multiline} maxLength={maxLength} style={{ padding: 12, borderColor: c.line, borderWidth: 1, borderRadius: 10, minHeight: multiline ? 100 : 46, textAlignVertical: multiline ? 'top' : 'center' }}/></View>;
    const back = () => { if (busy)
        return; if (draft) {
        if (dirty)
            Alert.alert('Discard unsaved changes?', 'Your last saved job stays in your workspace.', [{ text: 'Keep editing', style: 'cancel' }, { text: 'Discard', style: 'destructive', onPress: () => { setDraft(null); setDirty(false); } }]);
        else
            setDraft(null);
    }
    else
        onClose(); };
    return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 14 }}>{button(draft ? 'Back to jobs' : 'Back to listings', back)}<Text accessibilityRole="header" style={{ fontSize: 24, fontWeight: '800' }}>{draft ? 'Post a job' : 'Jobs'}</Text>
 {!!error && <Text accessibilityRole="alert" style={{ color: c.danger }}>{error}</Text>}{!!notice && <Text accessibilityLiveRegion="polite">{notice}</Text>}{busy && <ActivityIndicator />}
 {limits && <View style={{ padding: 14, borderRadius: 12, borderWidth: 1, borderColor: c.line, gap: 6 }}><Text style={{ fontWeight: '700' }}>{limits.remaining} of {limits.limit} active job places remaining</Text><Text style={{ fontSize: 12, color: c.muted }}>{limits.note}</Text>{!limits.verified && <Text style={{ color: c.danger }}>Provider approval is required before publishing.</Text>}{limits.remaining === 0 && <Text style={{ color: c.danger }}>Your active job allowance is full. Close or fill an active job, or wait for its deadline, before publishing another. You can still save job drafts.</Text>}</View>}
 {!draft ? <>{button('Post a job', () => edit(newJob(Crypto.randomUUID())), false, true)}<View style={{ flexDirection: 'row', gap: 8 }}>{[['published', 'Active'], ['draft', 'Drafts'], ['history', 'History']].map(([value, label]) => <Pressable key={value} onPress={() => setTab(value)} accessibilityRole="tab" accessibilityState={{ selected: tab === value }} style={{ flex: 1, padding: 12, backgroundColor: tab === value ? c.soft : c.surface, borderRadius: 10 }}><Text>{label}</Text></Pressable>)}</View>{loading && <ActivityIndicator />}{!items.length && !loading && <Text>No jobs in this section.</Text>}{items.map(job => <View key={job.id} style={{ borderWidth: 1, borderColor: c.line, borderRadius: 16, padding: 16, gap: 8 }}><Text style={{ fontSize: 19, fontWeight: '700' }}>{job.title || 'Untitled draft'}</Text><Text>{job.city} {job.state}</Text><Text>{job.effective_status || job.status} · {job.deadline ? `Apply by ${new Date(job.deadline).toLocaleDateString()}` : 'No deadline yet'}</Text>{button(job.status === 'removed' ? 'View removed job' : 'Review / edit', () => edit(job))}</View>)}{!!cursor && button('Load more', () => void load(cursor), loading)}{button('Refresh jobs and allowance', () => void load(), loading)}</> : <>
 {draft.status === 'removed' ? <JobDetails job={draft}/> : <><View style={{ flexDirection: 'row', gap: 8 }}>{['Details', 'How candidates apply', 'Preview'].map((label, i) => <Pressable key={label} disabled={busy} onPress={() => setStep(i)} style={{ flex: 1, padding: 10, backgroundColor: step === i ? c.soft : c.surface, borderRadius: 8 }}><Text>{label}</Text></Pressable>)}</View>
 {step === 0 && <>{field('Job title', draft.title, v => patch('title', v), false, 160)}{field('City / area', draft.city, v => patch('city', v), false, 100)}{field('State', draft.state, v => patch('state', v), false, 100)}<Text style={{ fontWeight: '700' }}>Work type</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{jobWorkTypes.map(([value, label]) => <Pressable key={value} disabled={busy} onPress={() => patch('work_type', value)} style={{ padding: 10, borderWidth: 1, borderColor: draft.work_type === value ? c.accent : c.line, borderRadius: 10 }}><Text>{label}</Text></Pressable>)}</View>{field('Work duration (optional, e.g. one day or permanent)', draft.work_duration, v => patch('work_duration', v), false, 200)}{field('Application deadline (YYYY-MM-DD)', deadline, v => { setDeadline(v); setDirty(true); }, false, 10)}<Text style={{ fontSize: 12 }}>The deadline controls applications, not the duration of the work.</Text>{field('Description', draft.description, v => patch('description', v), true, 10000)}{field('Requirements', draft.requirements, v => patch('requirements', v), true, 6000)}{field('Minimum / fixed pay (optional)', min, v => { setMin(v); setDirty(true); }, false, 15)}{field('Maximum pay (optional)', max, v => { setMax(v); setDirty(true); }, false, 15)}{field('Currency code', draft.currency_code, v => patch('currency_code', v.toUpperCase()), false, 3)}<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{['hour', 'day', 'week', 'month', 'year', 'project'].map(value => <Pressable key={value} disabled={busy} onPress={() => patch('pay_period', value)} style={{ padding: 10, borderWidth: 1, borderColor: draft.pay_period === value ? c.accent : c.line, borderRadius: 8 }}><Text>/{value}</Text></Pressable>)}</View>{button('Next: how candidates apply', () => setStep(1))}</>}
 {step === 1 && <>{(['external', 'email', 'chat'] as const).map(method => <Pressable key={method} disabled={busy} onPress={() => patch('application_method', method)} style={{ padding: 16, borderWidth: 1, borderRadius: 12, borderColor: method === draft.application_method ? c.accent : c.line }}><Text>{method === draft.application_method ? '● ' : '○ '}{method === 'external' ? 'External form or company website' : method === 'email' ? 'Email a CV' : 'Apply in ATL Xpres'}</Text></Pressable>)}{draft.application_method === 'external' && field('HTTPS application URL', draft.application_url, v => patch('application_url', v), false, 2048)}{draft.application_method === 'email' && field('Recruitment email', draft.application_email, v => patch('application_email', v), false, 254)}{field('Application instructions (optional)', draft.application_instructions, v => patch('application_instructions', v), true, 2000)}{button('Save and preview job', () => void run(async () => { await save(); if (live.current)
                setStep(2); }), false, true)}</>}
 {step === 2 && <><JobDetails job={draft} preview/>{dirty && <Text>Save changes to update this preview before publishing.</Text>}{button(draft.status === 'published' ? 'Published' : 'Publish job', () => void run(() => transition('published')), dirty || !draft.revision || !limits?.verified || limits.remaining < 1 || draft.status === 'published', true)}</>}
 {button('Save changes', () => void run(async () => { await save(); }))}{button('Load server copy', () => void run(async () => { await recover(draft.id); await load(); }))}{draft.status === 'published' && <>{button('Close applications', () => void run(() => transition('closed')), dirty)}{button('Mark as filled', () => void run(() => transition('filled')), dirty)}</>}
 </>}
 </>}
 </ScrollView>;
}
