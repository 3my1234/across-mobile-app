import type {ProductSubscription, Purchase} from 'expo-iap';

export type PlayPlan = {product_id: string; base_plan_id: string; plan_id: string; name: string; duration_months: number; amount_minor: number};
export type PlayCatalog = {account_id: string; items: PlayPlan[]; status: string; state: string; expires_at?: string; auto_renews: boolean; needs_acknowledgement: boolean};
const sku = /^[a-z0-9][a-z0-9._-]{0,199}$/;
export function playCatalog(value: unknown): PlayCatalog {
  const item = value as PlayCatalog;
  if (!item || !/^[a-f0-9]{64}$/.test(item.account_id) || !Array.isArray(item.items) || item.items.length > 100) throw Error('Google Play plans could not load.');
  const seen = new Set<string>();
  for (const plan of item.items) {
    const key = `${plan.product_id}:${plan.base_plan_id}`;
    if (!sku.test(plan.product_id) || !sku.test(plan.base_plan_id) || typeof plan.name !== 'string' || ![1, 12].includes(plan.duration_months) || !Number.isSafeInteger(plan.amount_minor) || plan.amount_minor <= 0 || seen.has(key)) throw Error('Google Play plans could not load.');
    seen.add(key);
  }
  return item;
}

// Display and select only the actual Play price/offer matching the server's
// approved base plan. No trial, introductory offer or guessed fallback price.
export function playOffer(plan: PlayPlan, products: ProductSubscription[]) {
  const product = products.find(value => value.platform === 'android' && value.id === plan.product_id);
  if (!product || product.platform !== 'android') return null;
  const offers = product.subscriptionOfferDetailsAndroid.filter(value => value.basePlanId === plan.base_plan_id && !value.offerId);
  if (offers.length !== 1) return null;
  const offer = offers[0], phases = offer.pricingPhases.pricingPhaseList;
  if (phases.length !== 1) return null;
  const price = phases[0];
  if (!/^[0-9]{1,20}$/.test(price.priceAmountMicros) || price.priceCurrencyCode !== 'NGN' || price.billingPeriod !== (plan.duration_months === 12 ? 'P1Y' : 'P1M') || price.recurrenceMode !== 1 || BigInt(price.priceAmountMicros) !== BigInt(plan.amount_minor) * 10000n || !offer.offerToken || !price.formattedPrice) return null;
  return {offerToken: offer.offerToken, displayPrice: price.formattedPrice};
}

export function playPurchasePayload(purchase: Purchase, catalog: PlayCatalog) {
  if (purchase.store !== 'google' || purchase.platform !== 'android' || !purchase.purchaseToken || purchase.purchaseToken.length < 16 || purchase.purchaseToken.length > 4096 || /[\r\n\x00]/.test(purchase.purchaseToken)) throw Error('Restore this purchase from Google Play before paying again.');
  if ('obfuscatedAccountIdAndroid' in purchase && purchase.obfuscatedAccountIdAndroid && purchase.obfuscatedAccountIdAndroid !== catalog.account_id) throw Error('This purchase belongs to a different provider account.');
  const plans = catalog.items.filter(plan => plan.product_id === purchase.productId && (!purchase.currentPlanId || plan.base_plan_id === purchase.currentPlanId));
  if (plans.length !== 1) throw Error('This purchase needs a billing-status refresh or Support review.');
  return {purchase_token: purchase.purchaseToken, product_id: plans[0].product_id, base_plan_id: plans[0].base_plan_id};
}

type Confirmation = {active: boolean; pending: boolean; needs_acknowledgement: boolean; expires_at: string; refund_state?: 'requested' | 'confirmed'};
export function createPlayPurchaseProcessor(verify: (body: ReturnType<typeof playPurchasePayload>) => Promise<Confirmation>, finish: (purchase: Purchase) => Promise<void>, changed: () => Promise<void>) {
  const flights = new Map<string, Promise<string>>();
  return (purchase: Purchase, catalog: PlayCatalog): Promise<string> => {
    const payload = playPurchasePayload(purchase, catalog), previous = flights.get(payload.purchase_token);
    if (previous) return previous;
    const flight = (async () => {
      const result = await verify(payload);
      if (result.refund_state) return result.refund_state === 'confirmed' ? 'Google Play confirmed a refund for this duplicate purchase. Your previous subscription remains unchanged.' : 'Your previous subscription remains unchanged. A refund for this duplicate purchase has been requested; confirmation is still pending.';
      // Local purchase callbacks never grant access or acknowledge an unpaid
      // purchase. The backend must have committed and acknowledged it first.
      if (result.pending) return 'Payment is pending in Google Play. Do not pay again; restore purchases when it completes.';
      if (!result.active) {await changed(); return 'This purchase is not currently active. Check Google Play for payment or renewal details.';}
      if (!Number.isFinite(Date.parse(result.expires_at)) || Date.parse(result.expires_at) <= Date.now()) throw Error('Payment status needs another check. Restore purchases before paying again.');
      await changed();
      if (result.needs_acknowledgement) return 'Paid access was verified. Final confirmation is being retried; restore purchases before paying again.';
      await finish(purchase);
      return 'Google Play payment verified. Your provider access has been updated.';
    })().finally(() => flights.delete(payload.purchase_token));
    flights.set(payload.purchase_token, flight);
    return flight;
  };
}
