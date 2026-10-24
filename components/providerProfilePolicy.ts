export const profileFields = [['business_name', 'Business name'], ['description', 'About your business'], ['contact_email', 'Contact email'], ['contact_phone', 'Contact phone'], ['website_url', 'Website (optional HTTPS link)'], ['address_line', 'Address'], ['city', 'City'], ['state', 'State / region'], ['country_code', 'Country code (NG)']] as const;
export function providerProfilePayload(form: Record<string, string>, current: {logo_url?: string}) {
  const payload = Object.fromEntries(profileFields.map(([key]) => [key, String(form[key] || '').trim()]));
  if (!payload.business_name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.contact_email) || !payload.contact_phone) throw new Error('Enter your business name, valid contact email and phone.');
  payload.country_code = payload.country_code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(payload.country_code)) throw new Error('Enter a two-letter country code.');
  if (payload.website_url) {let url; try {url = new URL(payload.website_url);} catch {throw new Error('Enter a valid HTTPS website or leave it blank.');} if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Enter a valid HTTPS website or leave it blank.');}
  // This full-body endpoint also writes logo_url: use the newest server value.
  return {...payload, logo_url: current.logo_url || ''};
}
