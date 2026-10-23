export type ProviderOrder = {id: string; package_label?: string; currency_code: string; total_amount: number; status: string; created_at: string; items?: {title: string; quantity: number; unit_price: number; product_snapshot?: {image_urls?: string[]}}[]; fulfillment_contact?: {full_name?: string; phone?: string; address?: string; city?: string; state?: string}; seller_funds?: {status?: string; note?: string; expected_amount?: number; payout_amount?: number | null}; fulfillment?: {route: string; owner: string; status: string; version: number; current_location?: string; estimated_delivery_at?: string; carrier?: string; tracking_number?: string; tracking_url?: string}};
const local: Record<string, string[]> = {pending: ['accepted'], accepted: ['packed'], packed: ['ready_for_pickup', 'out_for_delivery'], ready_for_pickup: ['delivered'], out_for_delivery: ['delivered']};
const imported: Record<string, string[]> = {pending: ['accepted'], accepted: ['processing'], processing: ['dispatched_from_origin'], dispatched_from_origin: ['international_transit'], international_transit: ['customs_clearance', 'local_hub'], customs_clearance: ['local_hub'], local_hub: ['ready_for_pickup', 'out_for_delivery'], ready_for_pickup: ['delivered'], out_for_delivery: ['delivered']};
export function providerOrderActions(order: ProviderOrder) {
  const f = order.fulfillment;
  if (!f || f.owner !== 'merchant' || !Number.isSafeInteger(f.version) || f.version < 1) return [];
  if (f.route === 'merchant_cross_border' && order.seller_funds?.status !== 'settled') return [];
  return (f.route === 'merchant_local' ? local : f.route === 'merchant_cross_border' ? imported : {})[f.status] || [];
}
export type TrackingDraft = {notes: string; location: string; carrier: string; tracking_number: string; tracking_url: string; delivery_date?: string; delivery_time?: string};
export function providerETA(date = '', time = '') {
  if (!date && !time) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) throw Error('Enter both estimated delivery date (YYYY-MM-DD) and local time (HH:MM).');
  const value = new Date(`${date}T${time}:00`);
  const [year, month, day] = date.split('-').map(Number), [hour, minute] = time.split(':').map(Number);
  if (!Number.isFinite(value.getTime()) || value.getFullYear() !== year || value.getMonth() + 1 !== month || value.getDate() !== day || value.getHours() !== hour || value.getMinutes() !== minute) throw Error('Choose a valid estimated delivery date and local time.');
  return value.toISOString();
}
export function providerETADraft(raw?: string) {
  const date = new Date(raw || '');
  const pad = (value: number) => String(value).padStart(2, '0');
  return Number.isFinite(date.getTime()) ? {delivery_date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`, delivery_time: `${pad(date.getHours())}:${pad(date.getMinutes())}`} : {delivery_date: '', delivery_time: ''};
}
export function providerOrderUpdate(order: ProviderOrder, next: string, draft: TrackingDraft, key: string) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(order.id) || !providerOrderActions(order).includes(next)) throw Error('This order cannot make that change. Refresh its status and settlement first.');
  if (!key || key.length > 160) throw Error('The tracking update identifier is unavailable. Retry.');
  if (draft.tracking_url.trim()) {const url = new URL(draft.tracking_url.trim()); if (url.protocol !== 'https:' || url.username || url.password) throw Error('Enter a secure HTTPS tracking URL without credentials.');}
  return {status: next, expected_version: order.fulfillment!.version, idempotency_key: key, notes: draft.notes.trim(), location: draft.location.trim(), carrier: draft.carrier.trim(), tracking_number: draft.tracking_number.trim(), tracking_url: draft.tracking_url.trim(), estimated_delivery_at: providerETA(draft.delivery_date, draft.delivery_time)};
}
const validID = (id: string) => /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id);
export function commonProviderOrderActions(orders: ProviderOrder[]) {
  if (!orders.length || orders.length > 200 || new Set(orders.map(order => order.id)).size !== orders.length || orders.some(order => !validID(order.id))) return [];
  return providerOrderActions(orders[0]).filter(next => orders.every(order => providerOrderActions(order).includes(next)));
}
export function providerBulkPayload(orders: ProviderOrder[], next: string, key: string) {
  if (!commonProviderOrderActions(orders).includes(next) || !key || key.length > 100) throw Error('Choose up to 200 eligible orders with the same available next stage. Refresh changed orders first.');
  return {status: next, idempotency_key: key, orders: orders.map(order => ({order_id: order.id, expected_version: order.fulfillment!.version}))};
}
export function providerManifestPayload(orders: ProviderOrder[], country: string, city: string, now = new Date()) {
  if (!orders.length || orders.length > 500 || new Set(orders.map(order => order.id)).size !== orders.length || orders.some(order => !validID(order.id) || order.fulfillment?.route !== 'merchant_cross_border' || order.fulfillment?.owner !== 'merchant' || !['pending', 'accepted', 'processing'].includes(order.fulfillment?.status || '') || order.seller_funds?.status !== 'settled')) throw Error('Select settled imported orders that are pending, accepted or processing.');
  if (!/^[A-Z]{2}$/.test(country.trim().toUpperCase()) || !city.trim()) throw Error('Enter a two-letter origin country and origin city.');
  return {order_ids: orders.map(order => order.id), origin_country_code: country.trim().toUpperCase(), origin_city: city.trim(), cutoff_at: now.toISOString()};
}
export type ProviderManifest = {id: string; manifest_code: string; status: string; version: number; origin_country_code: string; origin_city: string; order_count?: number};
export function manifestActions(manifest: ProviderManifest) {
  if (!validID(manifest.id) || !Number.isSafeInteger(manifest.version) || manifest.version < 1) return [];
  return ({open: ['closed', 'cancelled'], closed: ['dispatched', 'cancelled'], dispatched: ['completed']} as Record<string, string[]>)[manifest.status] || [];
}
export function manifestUpdate(manifest: ProviderManifest, next: string, key: string) {
  if (!manifestActions(manifest).includes(next) || !key || key.length > 100) throw Error('This manifest has changed. Refresh before updating.');
  return {status: next, expected_version: manifest.version, idempotency_key: key, notes: ''};
}
export function manifestPrintHTML(data: {manifest: ProviderManifest; items: Record<string, any>[]}) {
  const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, character => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[character]!));
  return `<html><head><meta charset="utf-8"><title>${escape(data.manifest.manifest_code)}</title><style>body{font:14px sans-serif;padding:24px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #bbb;padding:8px;text-align:left}</style></head><body><h1>${escape(data.manifest.manifest_code)}</h1><p>${escape(data.manifest.origin_city)}, ${escape(data.manifest.origin_country_code)} · ${escape(data.manifest.status)}</p><table><tr><th>Package</th><th>Product</th><th>Quantity</th><th>Buyer</th><th>Contact</th></tr>${data.items.map(item => `<tr><td>${escape(item.package_code)}</td><td>${escape(item.product?.title || item.product?.sku || item.item_id)}</td><td>${escape(item.quantity)}</td><td>${escape(item.buyer?.full_name)}</td><td>${escape(item.buyer?.phone)}<br>${escape(item.buyer?.email)}</td></tr>`).join('')}</table></body></html>`;
}
