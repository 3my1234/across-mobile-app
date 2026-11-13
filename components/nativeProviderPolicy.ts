export type ProviderAccount = {
  id: string; business_name: string; verification_status: string; verification_notes?: string;
  is_active: boolean; is_driver?: boolean; contact_email?: string; contact_phone?: string;
  can_sell_products?: boolean; can_offer_services?: boolean;
  description?: string; website_url?: string; address_line?: string; city?: string; state?: string; country_code?: string;
  provider_identity?: {avatar_url?: string; banner_url?: string; tier?: string};
  subscription?: {status: string; current_period_end?: string; billing_mode?: string; billing_provider?: 'flutterwave' | 'google_play'};
};
export const verificationKinds = [
  ['government_id', 'Government ID'], ['business_registration', 'Business registration'],
  ['professional_license', 'Professional qualification'], ['property_authority', 'Property authority'],
  ['address_proof', 'Proof of address'], ['drivers_license', 'Driver licence'],
  ['driver_vehicle', 'Car / vehicle'], ['driver_plate', 'Plate number'],
  ['driver_face', 'Clear face photo (shown to customers)'],
  ['vehicle_registration', 'Vehicle registration / licence'], ['vehicle_insurance', 'Vehicle insurance'],
  ['roadworthiness', 'Roadworthiness certificate'], ['driver_lasrra', 'Lagos LASRRA card'], ['driver_lasdri', 'Lagos LASDRI card'],
] as const;
export const driverPhotoKinds = ['drivers_license', 'driver_face', 'driver_vehicle', 'driver_plate', 'vehicle_registration', 'vehicle_insurance', 'roadworthiness', 'driver_lasrra', 'driver_lasdri'];
export const driverExpiryKinds = ['drivers_license', 'vehicle_insurance', 'roadworthiness'];
export function requiredDriverDocuments(provider: Pick<ProviderAccount, 'country_code' | 'state'>) {
  return ['drivers_license', 'driver_face', 'driver_vehicle', 'driver_plate', 'vehicle_registration'];
}
export type VerificationDocument = {id:string;document_type:string;status:string;review_notes?:string;expires_on?:string;created_at?:string};
export const verificationChecklist = (driver:boolean) => driver ? [
  {kind:'drivers_license',label:'Driver licence / ID',group:'Identity',icon:'card-outline',help:'Required. Your current driver licence also counts as your government-issued ID; upload it once.'},
  {kind:'driver_face',label:'Clear face photo',group:'Identity',icon:'person-outline',help:'Required. Your own unobstructed, passport-style face photo. Shown to customers after approval.'},
  {kind:'driver_vehicle',label:'Vehicle photo',group:'Vehicle',icon:'car-outline',help:'Required. The exact car or bike you will use. Shown to customers after approval.'},
  {kind:'driver_plate',label:'Plate number',group:'Vehicle',icon:'ellipsis-horizontal-circle-outline',help:'Required. Upload a clear photo of the number plate. Shown to customers after approval.'},
  {kind:'vehicle_registration',label:'Vehicle registration',group:'Vehicle',icon:'document-text-outline',help:'Required. Registration must match the vehicle and plate. Visible only to authorized reviewers.'},
] : [{kind:'government_id',label:'Government-issued ID',group:'Identity',icon:'card-outline',help:'Required. Upload a clear government-issued ID, such as a national ID, passport, voter card or driver licence.'}];
export function latestVerificationDocument(documents:VerificationDocument[],kind:string) {
  return documents.filter(document=>document.document_type===kind).sort((a,b)=>(b.created_at||'').localeCompare(a.created_at||'') || (a.created_at&&b.created_at?b.id.localeCompare(a.id):0))[0];
}
export function verificationDocumentStatus(document:VerificationDocument|undefined,kind:string,now=Date.now()) {
  if(!document)return {label:'Required',tone:'danger' as const,submitted:false};
  const expired=!!document.expires_on && document.expires_on<new Date(now).toISOString().slice(0,10);
  if(expired || (kind==='drivers_license'&&document.status==='approved'&&!document.expires_on))return {label:expired?'Expired':'Needs replacement',tone:'danger' as const,submitted:false};
  if(document.status==='approved')return {label:'Approved',tone:'success' as const,submitted:true};
  if(document.status==='pending')return {label:'Under review',tone:'pending' as const,submitted:true};
  return {label:'Needs replacement',tone:'danger' as const,submitted:false};
}
export function identityVerificationDocument(documents:VerificationDocument[]) {
  const choices=['government_id','drivers_license'].map(kind=>latestVerificationDocument(documents,kind)).filter((document):document is VerificationDocument=>!!document);
  return choices.find(document=>verificationDocumentStatus(document,document.document_type).label==='Approved') || choices.find(document=>document.status==='pending') || choices[0];
}
export function verificationExpiryError(kind: string, value: string, now = Date.now()) {
  if (!value.trim()) return driverExpiryKinds.includes(kind) ? 'Enter the expiry date printed on this document.' : '';
  const date = Date.parse(value.trim() + 'T00:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.trim()) || !Number.isFinite(date) || new Date(date).toISOString().slice(0, 10) !== value.trim() || date < Math.floor(now / 86400000) * 86400000) return 'Enter a current expiry date as YYYY-MM-DD.';
  return '';
}
export function hasPaidProviderAccess(provider: ProviderAccount, now = Date.now()) {
  const end = Date.parse(provider.subscription?.current_period_end || '');
  return provider.subscription?.status === 'active' && Number.isFinite(end) && end > now;
}
export function verificationImageError(mime: string, bytes: number) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) return 'Choose a JPG, PNG or WebP photo.';
  if (!Number.isFinite(bytes) || bytes <= 0 || bytes > 10 * 1024 * 1024) return 'Choose a clear photo no larger than 10 MB.';
  return '';
}
export function verificationFileError(kind: string, mime: string, bytes: number) {
  if (driverPhotoKinds.includes(kind)) return verificationImageError(mime, bytes);
  if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(mime)) return 'Choose a PDF, JPG, PNG or WebP document.';
  if (!Number.isFinite(bytes) || bytes <= 0 || bytes > 10 * 1024 * 1024) return 'Choose a document no larger than 10 MB.';
  return '';
}
export function privateDocumentPreviewURL(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('A secure document preview is unavailable. Refresh and retry.');
  return url.href;
}
export function nativeProviderView(route: string) {
  const query = new URLSearchParams(route);
  const view = query.get('view') || 'overview';
  // Reject malformed or ambiguous destinations instead of showing unrelated data.
  if (query.has('ticket') && (view !== 'support' || !validProviderID(query.get('ticket')))) return 'legacy';
  if (view === 'support' && ['conversation', 'shared', 'hall'].some(key => query.has(key))) return 'legacy';
  if (['conversation', 'shared', 'hall'].some(key => query.has(key))) return ['conversation', 'shared', 'hall'].every(key => !query.has(key) || validProviderID(query.get(key))) ? 'messages' : 'legacy';
  if (['event', 'notification'].some(key => query.has(key) && !validProviderID(query.get(key)))) return 'legacy';
  if (query.has('listing') && (!['products','listings'].includes(view) || !validProviderID(query.get('listing')))) return 'legacy';
  if (query.has('request') && (view !== 'requests' || !validProviderID(query.get('request')))) return 'legacy';
  return ['overview', 'notifications', 'profile', 'verification', 'subscription', 'products', 'listings', 'messages', 'support', 'driver', 'requests', 'merchant-orders'].includes(view) ? view : 'legacy';
}
export function providerRouteContext(route: string) {
  const query = new URLSearchParams(route), id = (key: string) => validProviderID(query.get(key)) ? query.get(key)! : '';
  return {event: id('event'), notification: id('notification'), request: id('request'), listing: id('listing')};
}
export function providerSupportTicket(route: string) {
  if (nativeProviderView(route) !== 'support') return undefined;
  const value = new URLSearchParams(route).get('ticket');
  return validProviderID(value) ? value! : undefined;
}
const validProviderID = (value: string | null) => Boolean(value && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value));
export function providerMessageDestination(route: string) {
  const query = new URLSearchParams(route), id = (key: string) => validProviderID(query.get(key)) ? query.get(key)! : '';
  return {conversation: id('shared') || id('conversation'), hall: id('hall'), event: id('event'), mode: id('hall') || query.get('mode') === 'town-hall' ? 'town-hall' as const : 'chats' as const};
}
