export type ProviderBooking = {id: string; listing_id?: string; status: string; listing_title: string; request_type: string; message?: string; party_size: number; starts_at?: string; ends_at?: string; buyer?: {full_name?: string; email?: string; phone?: string}};
export const bookingFilters = ['', 'pending', 'accepted', 'rejected', 'completed'] as const;
export function bookingActions(status: string) {
  return status === 'pending' ? ['accepted', 'rejected'] : status === 'accepted' ? ['completed'] : [];
}
export function bookingTransition(item: ProviderBooking, next: string) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(item.id) || !bookingActions(item.status).includes(next)) throw Error('This request has changed. Refresh before updating it.');
  return {status: next};
}
function localDate(date: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) throw Error('Enter dates as YYYY-MM-DD and times as HH:MM (24-hour).');
  const [year, month, day] = date.split('-').map(Number), [hour, minute] = time.split(':').map(Number);
  const value = new Date(year, month - 1, day, hour, minute);
  if (value.getFullYear() !== year || value.getMonth() !== month - 1 || value.getDate() !== day || value.getHours() !== hour || value.getMinutes() !== minute) throw Error('Choose a valid date and time in your phone’s time zone.');
  return value;
}
export type AvailabilityDraft = {startDate: string; startTime: string; endDate: string; endTime: string; capacity: string};
export function availabilityPayload(draft: AvailabilityDraft, now = Date.now()) {
  const start = localDate(draft.startDate, draft.startTime), end = localDate(draft.endDate, draft.endTime);
  if (start.getTime() <= now || end <= start) throw Error('Choose a future start and an end after the start.');
  const capacity = Number(draft.capacity);
  if (!/^\d+$/.test(draft.capacity.trim()) || !Number.isSafeInteger(capacity) || capacity < 1 || capacity > 2147483647) throw Error('Capacity must be a positive whole number.');
  return {starts_at: start.toISOString(), ends_at: end.toISOString(), capacity, status: 'open'};
}
