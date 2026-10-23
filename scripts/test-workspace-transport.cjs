const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript'), assert = require('node:assert/strict');
const compile = code => ts.transpileModule(code, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React, esModuleInterop: true}}).outputText;
let status = 404, plain = true, pending = false, profile = 'customer@example.test', actor = 'new-customer-session';
const calls = [];
const utils = fs.readFileSync('components/utils.ts', 'utf8'); const readerCode = utils.slice(utils.indexOf('export async function fetchJSONWithTimeout'), utils.indexOf('// Only history reads'));
const reader = {exports: {}, AbortController, setTimeout, clearTimeout, fetch: async (url, init) => {
  calls.push({url, init}); const code = url.endsWith('/profile') || url.includes('/notifications') ? 200 : status;
  return {ok: code >= 200 && code < 300, status: code, headers: {get: () => null}, json: async () => {
    if (plain && code !== 200) throw new SyntaxError('Unexpected token p: provider profile not found');
    if (url.endsWith('/profile')) return {email: profile}; return code === 200 ? {id: 'existing-business'} : {message: 'Unavailable'};
  }};
}};
vm.runInNewContext(compile(readerCode), reader);
const api = {exports: {}, require: name => name === './config' ? {API_URL: 'https://api.example.test'} : reader.exports}; vm.runInNewContext(compile(fs.readFileSync('components/nativeProviderApi.ts', 'utf8')), api);
let hooks = [], index = 0, effects = [], changed = false, tree; const resolved = [];
const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
const react = {
  createElement: (type, props, ...children) => ({type, props: props || {}, children: children.flat(Infinity)}),
  useState: value => {const i = index++; if (!(i in hooks)) hooks[i] = value; return [hooks[i], next => {hooks[i] = typeof next === 'function' ? next(hooks[i]) : next; changed = true;}];},
  useRef: value => {const i = index++; return hooks[i] || (hooks[i] = {current: value});},
  useCallback: (fn, deps) => {const i = index++; if (!hooks[i] || !same(hooks[i].deps, deps)) hooks[i] = {deps, fn}; return hooks[i].fn;},
  useEffect: (fn, deps) => {const i = index++; if (!hooks[i] || !same(hooks[i].deps, deps)) {const old = hooks[i]; hooks[i] = {deps}; effects.push(() => {old?.cleanup?.(); hooks[i].cleanup = fn();});}},
};
const gate = {exports: {}, require: name => {
  if (name === 'react') return react;
  if (name === 'react-native') return {ActivityIndicator: 'Spinner', Pressable: 'Button', View: 'View'};
  if (name === 'react-native-safe-area-context') return {useSafeAreaInsets: () => ({top: 0, bottom: 0})};
  if (name === './ThemeProvider') return {ThemedText: 'Text'};
  if (name === './AccountDesign') return {useAccountDesign: () => ({}), accountDesign: {}};
  if (name === './nativeProviderApi') return api.exports;
  if (name === './workspaceIntent') return {hasPendingProviderSignup: async () => pending, signupWorkspaceFor: async email => email === 'old-provider@example.test' ? 'provider' : 'auto'};
  throw Error('Unexpected ' + name);
}};
vm.runInNewContext(compile(fs.readFileSync('components/ProviderEntryGate.tsx', 'utf8')), gate);
function reset() {hooks.forEach(h => h?.cleanup?.()); hooks = []; resolved.length = 0; calls.length = 0;}
function render() {index = 0; effects = []; changed = false; tree = gate.exports.ProviderEntryGate({token: actor, intent: 'auto', onResolved: value => resolved.push(value)}); effects.forEach(fn => fn());}
async function settle() {for (let i = 0; i < 8; i++) {await new Promise(resolve => setImmediate(resolve)); if (changed) render();}}
const text = node => typeof node === 'string' ? node : node?.children?.map(text).join('') || '';
(async () => {
  status = 200; actor = 'old-provider-session'; render(); await settle(); assert.deepEqual(resolved, [true]);
  reset(); actor = 'new-customer-session'; status = 404; pending = true; render(); await settle(); assert.deepEqual(resolved, [false], 'real plain-text HTTP404 must open customer after previous provider logout');
  assert.equal(calls.length, 2); assert.ok(calls.every(call => call.init.headers.Authorization === 'Bearer new-customer-session')); assert.ok(calls.some(call => call.url.endsWith('/profile')), 'real request helper must permit the authenticated profile read');
  reset(); pending = false; status = 500; render(); await settle(); assert.deepEqual(resolved, []); assert.match(text(tree), /could not check/); assert.ok(!text(tree).includes('Unexpected token'));
  reset(); status = 401; render(); await settle(); assert.deepEqual(resolved, [], 'unauthorized is not silently treated as a customer');
  await api.exports.providerRequest(actor, '/notifications'); await api.exports.providerRequest(actor, '/notifications/read-all', {method: 'PATCH'});
  await assert.rejects(api.exports.providerRequest(actor, '/profile', {method: 'PUT'}), /Unsupported/);
  console.log('Real workspace request pipeline passed: provider→customer with text404, correct new token, scoped profile/inbox routes and preserved401/500 errors.');
})().catch(error => {console.error(error); process.exitCode = 1;});
