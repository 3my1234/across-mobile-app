type Position = {timestamp: number; coords: {latitude: number; longitude: number; accuracy: number | null}};
export type DriverPresencePayload = {listing_id: string; latitude: number; longitude: number; accuracy_m: number; captured_at: string};
export function driverPresencePayload(listing: string, position: Position, now = Date.now()): DriverPresencePayload {
  const {latitude, longitude, accuracy} = position.coords;
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(listing)) throw Error('Choose an approved driver service.');
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || accuracy === null || !Number.isFinite(accuracy) || accuracy < 0 || accuracy > 1000) throw Error('Wait for a location accurate to within 1 km, then retry.');
  if (!Number.isFinite(position.timestamp) || now - position.timestamp > 60000 || position.timestamp - now > 15000) throw Error('Refresh your current location, then retry.');
  return {listing_id: listing, latitude, longitude, accuracy_m: accuracy, captured_at: new Date(position.timestamp).toISOString()};
}
type Dependencies = {
  sessionKey: string;
  capture: () => Promise<Position>;
  publish: (payload: DriverPresencePayload) => Promise<unknown>;
  remove: () => Promise<unknown>;
  foreground: () => boolean;
  state: (online: boolean, message: string, status?: 'starting'|'online'|'offline') => void;
};
const cleanupByProvider = new Map<string, Promise<void>>();
// One foreground lease, one heartbeat at a time. Never queue a restart behind
// an old stop: its delayed DELETE could remove the newly published lease.
export function createDriverPresence(deps: Dependencies) {
  let enabled = false, version = 0, listing = '';
  let flight: Promise<void> | null = null, stopping: Promise<void> | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const active = (epoch: number) => enabled && epoch === version && deps.foreground();
  const clear = () => {if (timer) clearTimeout(timer); timer = undefined;};
  async function tick() {
    if (flight || !active(version)) return;
    const epoch = version;
    flight = (async () => {
      try {
        const position = await deps.capture();
        if (!active(epoch)) return;
        const payload = driverPresencePayload(listing, position);
        await deps.publish(payload);
        if (active(epoch)) deps.state(true, 'Available nearby - location updated just now', 'online');
      } catch (error) {
        if (!active(epoch)) return;
        enabled = false; version++; clear();
        deps.state(false, `${error instanceof Error ? error.message : 'Availability could not update.'} You are offline on this device. Nearby visibility expires within two minutes if the connection is unavailable.`,'offline');
        // PUT failures can be ambiguous. Clear the lease, without retrying PUT.
        try {await deps.remove();} catch { /* Server TTL remains the fallback. */ }
      }
    })();
    try {await flight;} finally {
      flight = null;
      if (active(epoch)) timer = setTimeout(() => void tick(), 30000);
    }
  }
  function stop() {
    enabled = false; version++; clear();
    deps.state(false, 'Offline on this device. Nearby visibility expires within two minutes if the connection is unavailable.','offline');
    if (stopping) return stopping;
    const previousCleanup = cleanupByProvider.get(deps.sessionKey);
    // A late PUT must finish before DELETE. No new start is accepted until the
    // cleanup completes, including when leaving the screen or changing account.
    stopping = (async () => {
      try {await previousCleanup; await flight; await deps.remove();} catch { /* TTL handles offline cleanup. */ }
    })().finally(() => {
      if (cleanupByProvider.get(deps.sessionKey) === stopping) cleanupByProvider.delete(deps.sessionKey);
      stopping = null;
    });
    cleanupByProvider.set(deps.sessionKey, stopping);
    return stopping;
  }
  return {
    start(id: string) {
      if (enabled || flight || stopping || cleanupByProvider.has(deps.sessionKey) || !deps.foreground()) return false;
      listing = id; enabled = true; version++;
      deps.state(false, 'Finding your current location...', 'starting'); void tick(); return true;
    },
    stop,
  };
}
