const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict'), ts = require('typescript');
function load(path, dependencies = {}, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020}}).outputText;
  vm.runInNewContext(code, {exports, URL, URLSearchParams, setTimeout, clearTimeout, AbortController, require: name => {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency ${name}`);
    return dependencies[name];
  }, ...globals});
  return exports;
}
(async () => {
  const policy = load('components/nativeProviderPolicy.ts');
  const now = Date.parse('2026-10-22T10:00:00Z');
  const provider = {subscription: {status: 'active', current_period_end: '2026-11-22T10:00:00Z'}};
  assert.equal(policy.hasPaidProviderAccess(provider, now), true);
  for (const end of ['', 'invalid', '2026-10-22T10:00:00Z', '2026-10-01T00:00:00Z']) assert.equal(policy.hasPaidProviderAccess({subscription: {status: 'active', current_period_end: end}}, now), false);
  assert.equal(policy.hasPaidProviderAccess({subscription: {...provider.subscription, status: 'cancelled'}}, now), false);
  for (const kind of ['drivers_license', 'driver_vehicle', 'driver_plate']) assert.ok(policy.verificationKinds.some(([key]) => key === kind));
  assert.equal(policy.verificationImageError('image/jpeg', 10 * 1024 * 1024), '');
  for (const [mime, bytes] of [['application/pdf', 500], ['image/jpeg', 0], ['image/jpeg', 10 * 1024 * 1024 + 1]]) assert.ok(policy.verificationImageError(mime, bytes));
  assert.equal(policy.nativeProviderView('view=subscription'), 'subscription');
  for (const view of ['products', 'listings', 'profile']) assert.equal(policy.nativeProviderView('view='+view), view);
  for (const route of ['view=messages&conversation=abc', 'view=overview&event=abc']) assert.equal(policy.nativeProviderView(route), 'legacy');
  let calls = [], next = {response: {ok: true}, body: {status: 'stopped'}};
  const api = load('components/nativeProviderApi.ts', {
    './config': {API_URL: 'https://api.example.test'},
    './utils': {fetchJSONWithTimeout: async (...args) => {calls.push(args); return next;}},
  }, {fetch: async (url, init) => {calls.push([url, init]); return {ok: true, blob: async () => 'photo-bytes'};}});
  await api.providerRequest('account-session', '/providers/me/subscription-renewal', {method: 'POST', body: JSON.stringify({next_plan_id: ''})});
  assert.equal(calls[0][0], 'https://api.example.test/api/v1/providers/me/subscription-renewal');
  assert.equal(calls[0][1].headers.Authorization, 'Bearer account-session');
  assert.equal(calls[0][2], 45000);
  assert.equal(JSON.parse(calls[0][1].body).next_plan_id, '');
  next = {response: {ok: false, status: 403}, body: {message: 'Owner access required'}};
  await assert.rejects(api.providerRequest('member', '/providers/me/subscription-renewal'), error => error.status === 403 && error.message === 'Owner access required');
  assert.equal(calls.length, 2, 'denied mutation is never automatically replayed');
  await assert.rejects(api.providerRequest('token', 'https://other.test'), /Unsupported/);
  calls = [];
  await api.putProviderPhoto('https://storage.example.test/photo?signature=test', 'file:///selected.jpg', 'image/jpeg');
  assert.equal(calls.length, 2);
  assert.equal(calls[1][1].method, 'PUT');
  assert.equal(calls[1][1].headers.Authorization, undefined, 'storage receives no app bearer');
  assert.equal(calls[1][1].credentials, 'omit');
  await assert.rejects(api.putProviderPhoto('http://storage.example.test/photo', 'file:///x', 'image/jpeg'), /invalid/);
  await assert.rejects(api.putProviderPhoto('https://user:password@storage.example.test/photo', 'file:///x', 'image/jpeg'), /invalid/);
  console.log('Native provider tests passed: entitlement dates, driver evidence, deep links, ownership errors, no mutation replay, isolated signed photo upload.');
})().catch(error => {console.error(error); process.exitCode = 1;});
