export const providerTypes = [
  ['product_merchant', 'Products and retail'], ['service_professional', 'Skilled or professional services'],
  ['property_host', 'Property and accommodation'], ['mobility_provider', 'Vehicles and roadside services'],
  ['mixed', 'Products and services'], ['other', 'Something else'],
] as const;
export type ProviderApplication = {business_name: string; provider_type: string; provider_type_other: string; description: string; contact_email: string; contact_phone: string; website_url: string; address_line: string; city: string; state: string; country_code: string; is_driver: boolean};
export function providerApplicationPayload(form: ProviderApplication) {
  const payload = {...form};
  for (const key of Object.keys(payload) as (keyof ProviderApplication)[]) if (key !== 'is_driver') (payload[key] as string) = String(payload[key]).trim();
  payload.country_code = payload.country_code.toUpperCase();
  if (!payload.business_name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.contact_email) || !payload.contact_phone) throw new Error('Enter your business name, valid contact email and phone number.');
  if (!payload.city || !payload.state) throw new Error('Enter your business city and state / region.');
  if (!providerTypes.some(([key]) => key === payload.provider_type)) throw new Error('Choose the provider category that describes your work.');
  if (payload.provider_type === 'other' && !payload.provider_type_other) throw new Error('Describe what you provide.');
  if (!/^[A-Z]{2}$/.test(payload.country_code)) throw new Error('Enter a two-letter country code, such as NG.');
  if (payload.website_url) {let url; try {url = new URL(payload.website_url);} catch {throw new Error('Enter a valid HTTPS website or leave it blank.');} if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Enter a valid HTTPS website or leave it blank.');}
  return payload;
}
