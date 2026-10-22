export type ProviderPlan = {id: string; name: string; amount_ngn: number; period_prices?: {duration_months: number; amount_ngn: number}[]};
export type PendingProviderCheckout = {provider_id: string; tx_ref?: string; checkout_link?: string; created_at: string};
const uuid = (value: string) => /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
export function providerCheckoutPayload(plan: ProviderPlan, months: number, method: string, redirect: string) {
  if (!uuid(plan.id) || !Number.isFinite(plan.amount_ngn) || plan.amount_ngn <= 0 || ![1, 3, 6, 12].includes(months) || !['card', 'banktransfer'].includes(method) || method === 'card' && ![1, 12].includes(months) || providerPeriodPrice(plan, months) === undefined) throw Error('Choose an available plan, payment method and billing period. Refresh prices before paying.');
  if (redirect !== 'across://providers/subscription') throw Error('The payment return address is unavailable.');
  return {plan_id: plan.id, duration_months: months, payment_method: method, redirect_url: redirect};
}
export function providerCheckoutLink(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.username || url.password || !['checkout.flutterwave.com', 'flutterwave.com'].includes(url.hostname)) throw Error('The payment page could not be verified. Check payment status before retrying.');
  return url.href;
}
export function pendingProviderCheckout(raw: string | null, providerID: string): PendingProviderCheckout | null {
  if (!raw) return null;
  const item = JSON.parse(raw);
  if (item.provider_id !== providerID || !uuid(providerID) || !Number.isFinite(Date.parse(item.created_at))) throw Error('The saved payment cannot be verified. Check payment status before starting another checkout.');
  if (item.tx_ref && !/^PROVIDER-[a-f0-9-]{36}$/i.test(item.tx_ref)) throw Error('The saved payment reference is invalid. Contact Support before paying again.');
  if (item.checkout_link) providerCheckoutLink(item.checkout_link);
  return item;
}
export function providerPaymentReturn(raw: string, pending: PendingProviderCheckout) {
  const url = new URL(raw);
  if (!isProviderSubscriptionReturn(raw) || !pending.tx_ref) throw Error('This payment return is not associated with your saved checkout. Check payment status.');
  const ref = url.searchParams.get('tx_ref');
  if (ref && ref !== pending.tx_ref) throw Error('The payment reference changed. Check the saved payment status.');
  const transaction = url.searchParams.get('transaction_id') || '';
  if (transaction && !/^\d{1,30}$/.test(transaction)) throw Error('The payment identifier is invalid. Check payment status.');
  // A callback status never grants access. The Go API verifies amount/currency,
  // ownership/reference and transaction identity before applying paid access.
  return {tx_ref: pending.tx_ref, transaction_id: transaction};
}
export function isProviderSubscriptionReturn(raw: string) {
  try {const url = new URL(raw); return url.protocol === 'across:' && url.hostname === 'providers' && url.pathname === '/subscription' && !url.username && !url.password && !url.port;}
  catch {return false;}
}
export function providerPeriodPrice(plan: ProviderPlan, months: number) {
  const amount = months === 1 ? plan.amount_ngn : plan.period_prices?.find(price => price.duration_months === months)?.amount_ngn;
  return Number.isFinite(amount) && amount! > 0 ? amount : undefined;
}
