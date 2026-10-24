const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript'), assert = require('node:assert/strict');
let active = 0, peak = 0, alive = true, fail = false, held;
const calls = [], results = [];
const context = {exports: {}, require: name => {
  assert.equal(name, './nativeProviderApi');
  return {providerRequest: async (token, path) => {
    calls.push({token, path}); active++; peak = Math.max(peak, active);
    await (held || new Promise(resolve => setImmediate(resolve)));
    active--;
    if (fail) throw Error('Synthetic unavailable image read');
    return {id: path.split('/').at(-1), media_urls: ['https://media.example.test/service.jpg']};
  }};
}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/providerBookingImages.ts', 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020}}).outputText, context);
const bookings = Array.from({length: 30}, (_, i) => ({listing_id: `11111111-1111-4111-8111-${String(i).padStart(12, '0')}`}));
const run = rows => context.exports.loadBookingImages('synthetic-owner', rows, () => alive, (id, urls) => results.push({id, urls}));
(async () => {
  await run([...bookings, bookings[0], {listing_id: '../../other-account'}]);
  assert.equal(calls.length, 25); assert.equal(peak, 3, 'bounded concurrency, not a burst of 25 service reads');
  assert.ok(calls.every(call => call.token === 'synthetic-owner' && call.path.startsWith('/providers/me/listings/')));
  assert.equal(new Set(calls.map(call => call.path)).size, 25); assert.equal(results.length, 25);
  assert.equal(results[0].urls[0], 'https://media.example.test/service.jpg');
  calls.length = 0; results.length = 0; fail = true; await run([bookings[0]]); assert.equal(results[0].urls, null, 'failure remains distinguishable from no uploaded photos');
  fail = false; calls.length = 0; results.length = 0; let release; held = new Promise(resolve => {release = resolve;});
  const pending = run(bookings); alive = false; release(); await pending;
  assert.equal(calls.length, 3, 'stale page stops scheduling extra reads'); assert.equal(results.length, 0, 'late image results cannot cross sessions/pages');
  console.log('Booking image reads passed: private owner reads, page limit, deduplication, three concurrent reads, failure state and stale-page cancellation.');
})().catch(error => {console.error(error); process.exitCode = 1;});
