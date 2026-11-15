import { API_URL } from './config';
import { fetchJSONWithTimeout } from './utils';
export const jobWorkTypes = [['full_time', 'Full-time'], ['part_time', 'Part-time'], ['contract', 'Contract'], ['temporary', 'Temporary'], ['internship', 'Internship'], ['one_day', 'One-day shift'], ['volunteer', 'Volunteer']] as const;
export type Job = {
    id: string;
    provider_id: string;
    provider_name?: string;
    title: string;
    city: string;
    state: string;
    country_code: string;
    work_type: string;
    work_duration: string;
    description: string;
    requirements: string;
    pay_min: number | null;
    pay_max: number | null;
    currency_code: string;
    pay_period: string;
    application_method: 'external' | 'email' | 'chat';
    application_url: string;
    application_email: string;
    application_instructions: string;
    deadline: string | null;
    status: string;
    effective_status?: string;
    available?: boolean;
    availability_reason?: string;
    revision: number;
};
export async function jobsRequest(token: string, path: string, options: RequestInit = {}) {
    if (!/^\/(jobs(?:[/?]|$)|providers\/me\/jobs(?:[/?]|$))/.test(path))
        throw Error('Unsupported Jobs operation');
    const { response, body } = await fetchJSONWithTimeout(`${API_URL}/api/v1${path}`, { ...options, cache: 'no-store', headers: { ...options.headers, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) } }, 15000);
    if (!response.ok)
        throw Object.assign(Error(typeof body?.message === 'string' ? body.message : 'Jobs could not complete this request. Refresh before retrying.'), { status: response.status });
    return body;
}
export function jobDomain(raw: string) { try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || url.username || url.password || url.port && url.port !== '443' || !/^[a-z0-9.-]+\.[a-z]{2,63}$/.test(host) || /\.(localhost|local|internal|test|invalid)$/.test(host))
        return '';
    return host;
}
catch {
    return '';
} }
export function jobIsAvailable(job: Job, now = Date.now()) { return job.available === true && job.status === 'published' && !!job.deadline && Date.parse(job.deadline) > now; }
export function jobPay(job: Job) { return job.pay_min == null ? 'Pay not specified' : `${job.currency_code} ${Number(job.pay_min).toLocaleString()}${job.pay_max != null ? `–${Number(job.pay_max).toLocaleString()}` : ''} / ${job.pay_period}`; }
export function jobUnavailableReason(job: Job) { const reason = job.deadline && Date.parse(job.deadline) <= Date.now() && job.status === 'published' ? 'expired' : job.availability_reason || job.effective_status || job.status; return ({ expired: 'The application deadline has passed.', closed: 'The employer has closed applications.', filled: 'This position has been filled.', removed: 'This job was removed by moderation.', provider_unavailable: 'This employer is currently unavailable.', plan_limit: 'This job is currently unavailable.', draft: 'This is a draft.' } as Record<string, string>)[reason] || 'Applications are currently unavailable.'; }
export function jobDeadlineInput(value: string | null) { if (!value)
    return ''; const date = new Date(value); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
export function jobDeadlineISO(value: string) { const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value); if (!match)
    throw Error('Use YYYY-MM-DD for the application deadline.'); const [year, month, day] = match.slice(1).map(Number), date = new Date(year, month - 1, day, 23, 59, 59, 999); if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day)
    throw Error('Enter a real application deadline.'); return date.toISOString(); }
export function jobMailURL(email: string, title: string) { if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) || /[\r\n]/.test(email))
    throw Error('This recruitment address is invalid.'); return `mailto:${email}?subject=${encodeURIComponent(`Application for ${title}`)}`; }
export function newJob(id: string): Job { return { id, provider_id: '', title: '', city: '', state: '', country_code: 'NG', work_type: 'full_time', work_duration: '', description: '', requirements: '', pay_min: null, pay_max: null, currency_code: 'NGN', pay_period: 'month', application_method: 'chat', application_url: '', application_email: '', application_instructions: '', deadline: null, status: 'draft', revision: 0 }; }
export function jobLinkID(raw: string): string | null { try {
    const u = new URL(raw);
    const path = u.protocol === 'across:' && u.hostname === 'jobs' ? u.pathname : u.protocol === 'https:' && ['atlxpres.com', 'www.atlxpres.com'].includes(u.hostname) && u.pathname.startsWith('/jobs/') ? u.pathname.slice(5) : '';
    const id = path.replace(/^\//, '');
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) && !u.username && !u.password ? id : null;
}
catch {
    return null;
} }
