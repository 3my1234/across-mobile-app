export type ProviderOrder = {id: string; package_label?: string; currency_code: string; total_amount: number; status: string; created_at: string; items?: {title: string; quantity: number; unit_price: number}[]; fulfillment_contact?: {full_name?: string; phone?: string; address?: string; city?: string; state?: string}; seller_funds?: {status?: string; note?: string; expected_amount?: number; payout_amount?: number | null}; fulfillment?: {route: string; owner: string; status: string; version: number; current_location?: string; carrier?: string; tracking_number?: string; tracking_url?: string}};
const local: Record<string, string[]> = {pending: ['accepted'], accepted: ['packed'], packed: ['ready_for_pickup', 'out_for_delivery'], ready_for_pickup: ['delivered'], out_for_delivery: ['delivered']};
const imported: Record<string, string[]> = {pending: ['accepted'], accepted: ['processing'], processing: ['dispatched_from_origin'], dispatched_from_origin: ['international_transit'], international_transit: ['customs_clearance', 'local_hub'], customs_clearance: ['local_hub'], local_hub: ['ready_for_pickup', 'out_for_delivery'], ready_for_pickup: ['delivered'], out_for_delivery: ['delivered']};
export function providerOrderActions(order: ProviderOrder) {
  const f = order.fulfillment;
  if (!f || f.owner !== 'merchant' || !Number.isSafeInteger(f.version) || f.version < 1) return [];
  if (f.route === 'merchant_cross_border' && order.seller_funds?.status !== 'settled') return [];
  return (f.route === 'merchant_local' ? local : f.route === 'merchant_cross_border' ? imported : {})[f.status] || [];
}
export type TrackingDraft = {notes: string; location: string; carrier: string; tracking_number: string; tracking_url: string};
export function providerOrderUpdate(order: ProviderOrder, next: string, draft: TrackingDraft, key: string) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(order.id) || !providerOrderActions(order).includes(next)) throw Error('This order cannot make that change. Refresh its status and settlement first.');
  if (!key || key.length > 160) throw Error('The tracking update identifier is unavailable. Retry.');
  if (draft.tracking_url.trim()) {const url = new URL(draft.tracking_url.trim()); if (url.protocol !== 'https:' || url.username || url.password) throw Error('Enter a secure HTTPS tracking URL without credentials.');}
  return {status: next, expected_version: order.fulfillment!.version, idempotency_key: key, notes: draft.notes.trim(), location: draft.location.trim(), carrier: draft.carrier.trim(), tracking_number: draft.tracking_number.trim(), tracking_url: draft.tracking_url.trim()};
}
