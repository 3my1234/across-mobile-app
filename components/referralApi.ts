import {API_URL} from './config';
import {fetchJSONWithTimeout} from './utils';

export async function validateSignupReferral(raw: string) {
  const code = raw.trim().toUpperCase();
  if (!code) return;
  if (!/^[A-Z0-9]{12}$/.test(code)) throw Error('Enter the 12-character referral code, or leave it blank.');
  const {response, body} = await fetchJSONWithTimeout(`${API_URL}/api/v1/referrals/validate?code=${encodeURIComponent(code)}`, {cache: 'no-store'}, 12000);
  if (!response.ok) throw Error('Referral registration is not available right now. Retry later, or remove the code to continue without a referral.');
  if (body?.valid !== true) throw Error('This referral code is unavailable. Check it or leave it blank.');
}

export type ReferralSummary = {code: string; pending_signups: number; verified_signups: number; paid_providers: number; earned_xp: number; signup_xp: number; paid_provider_total_xp: number; paid_provider_additional_xp: number; minimum_withdrawal_xp: number};
export async function loadReferralSummary(token: string): Promise<ReferralSummary> {
  const {response, body} = await fetchJSONWithTimeout(`${API_URL}/api/v1/referrals/me`, {cache: 'no-store', headers: {Authorization: `Bearer ${token}`}}, 12000);
  if (!response.ok) throw Error(response.status === 404 ? 'Referrals are not available yet. Please check again later.' : 'Could not load your referrals. Please retry.');
  const counters = ['pending_signups', 'verified_signups', 'paid_providers', 'earned_xp', 'signup_xp', 'paid_provider_total_xp', 'paid_provider_additional_xp', 'minimum_withdrawal_xp'];
  if (!/^[A-Z0-9]{12}$/.test(body?.code || '') || counters.some(key => !Number.isSafeInteger(body?.[key]) || body[key] < 0) || body.paid_provider_total_xp !== body.signup_xp + body.paid_provider_additional_xp) throw Error('Referral details are unavailable. Please retry.');
  return body;
}
