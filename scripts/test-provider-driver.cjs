const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict'), ts = require('typescript');
const exportsPolicy = {}, timers = new Map(); let timerID = 0;
vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/providerDriverPresence.ts', 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020}}).outputText,
  {exports: exportsPolicy, Date, Error, setTimeout: callback => {timers.set(++timerID, callback); return timerID;}, clearTimeout: id => timers.delete(id)});
const {driverPresencePayload, createDriverPresence} = exportsPolicy;
const id = '33333333-3333-4333-8333-333333333333', now = Date.now();
const position = () => ({timestamp: Date.now(), coords: {latitude: 6.5, longitude: 3.3, accuracy: 25}});
const deferred = () => {let resolve, reject; const promise = new Promise((a, b) => {resolve = a; reject = b;}); return {promise, resolve, reject};};
const settle = async () => {for (let i = 0; i < 20; i++) await Promise.resolve();};
function fixture(changes = {}) {
  const events = [], states = []; let foreground = true;
  const session = createDriverPresence({sessionKey: id, capture: async () => {events.push('capture'); return position();},
    publish: async () => {events.push('put');}, remove: async () => {events.push('delete');},
    foreground: () => foreground, state: (online, message) => states.push({online, message}), ...changes});
  return {session, events, states, background: () => {foreground = false;}};
}
(async () => {
  assert.equal(driverPresencePayload(id, position()).listing_id, id);
  for (const changes of [{latitude: NaN}, {longitude: 181}, {latitude: -91}, {accuracy: null}, {accuracy: 1001}, {accuracy: -1}, {accuracy: Infinity}]) {
    assert.throws(() => driverPresencePayload(id, {...position(), coords: {...position().coords, ...changes}}));
  }
  for (const timestamp of [now - 60001, now + 15001, NaN]) assert.throws(() => driverPresencePayload(id, {...position(), timestamp}, now));
  assert.throws(() => driverPresencePayload('not-a-listing', position()));
  const gps = deferred(), waiting = fixture({capture: () => gps.promise});
  assert.equal(waiting.session.start(id), true); assert.equal(waiting.session.start(id), false, 'double start does not create another capture');
  const stopped = waiting.session.stop(); gps.resolve(position()); await stopped; await settle();
  assert.deepEqual(waiting.events, ['delete'], 'background/unmount during GPS must not send location');
  assert.equal(timers.size, 0);

  const put = deferred(), first = fixture({publish: () => {first.events.push('put'); return put.promise;}});
  first.session.start(id); await settle(); const stopping = first.session.stop(); await settle();
  assert.deepEqual(first.events, ['capture', 'put'], 'DELETE waits for in-flight PUT');
  const reopened = fixture(); assert.equal(reopened.session.start(id), false, 'a remounted screen cannot race old cleanup');
  put.resolve(); await stopping; await settle(); assert.deepEqual(first.events, ['capture', 'put', 'delete']);
  assert.equal(first.states.some(state => state.online), false, 'late success cannot display online after stop');
  assert.equal(reopened.session.start(id), true); await settle();
  assert.equal(reopened.states.at(-1).online, true); assert.equal(timers.size, 1);
  reopened.background(); const heartbeat = [...timers.values()][0]; timers.clear(); heartbeat(); await settle();
  assert.deepEqual(reopened.events, ['capture', 'put'], 'background heartbeat does not request GPS or publish');
  await reopened.session.stop(); assert.equal(timers.size, 0);

  const refresh = deferred(); let captures = 0;
  const periodic = fixture({capture: async () => ++captures === 1 ? position() : refresh.promise});
  periodic.session.start(id); await settle();
  const next = [...timers.values()][0]; timers.clear(); next(); next(); await settle();
  assert.equal(captures, 2, 'duplicate timer calls cannot overlap location capture');
  assert.equal(periodic.events.filter(item => item === 'put').length, 1);
  refresh.resolve(position()); await settle();
  assert.equal(periodic.events.filter(item => item === 'put').length, 2);
  assert.equal(timers.size, 1, 'one successful heartbeat schedules one successor');
  await periodic.session.stop(); assert.equal(timers.size, 0);

  const failed = fixture({publish: async () => {throw Error('Connection timed out');}});
  failed.session.start(id); await settle();
  assert.equal(failed.events.filter(item => item === 'capture').length, 1);
  assert.equal(failed.events.at(-1), 'delete', 'ambiguous publish failure attempts to clear lease');
  assert.equal(failed.states.at(-1).online, false); assert.equal(timers.size, 0, 'failed publish is not replayed');
  await failed.session.stop();

  const revoked = fixture({capture: async () => {throw Error('Location permission denied');}, remove: async () => {throw Error('No network');}});
  revoked.session.start(id); await settle(); await revoked.session.stop();
  assert.ok(revoked.states.some(state => state.message.includes('within two minutes')), 'offline cleanup failure explains server expiry');
  console.log('Driver availability passed: fresh accurate GPS, foreground-only publishing, no overlapping heartbeats, late PUT/stop/remount ordering, failure cleanup and lease expiry.');
})().catch(error => {console.error(error); process.exitCode = 1;});
