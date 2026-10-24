const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript'), assert = require('node:assert/strict');
const compile = code => ts.transpileModule(code, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React, esModuleInterop: true}}).outputText;
let status = 200, body, held; const calls = [], shared = []; const summary = {code: 'ABCDEF123456', pending_signups: 1, verified_signups: 1, paid_providers: 1, earned_xp: 500, signup_xp: 5, paid_provider_total_xp: 500, paid_provider_additional_xp: 495, minimum_withdrawal_xp: 1000};
const readerCode = fs.readFileSync('components/utils.ts', 'utf8'); const reader = {exports: {}, AbortController, setTimeout, clearTimeout, fetch: async (url, init) => {calls.push({url, init}); if (held) await held; return {status, ok: status === 200, json: async () => body};}};
vm.runInNewContext(compile(readerCode.slice(readerCode.indexOf('export async function fetchJSONWithTimeout'), readerCode.indexOf('// Only history reads'))), reader);
const api = {exports: {}, require: name => name === './config' ? {API_URL: 'https://api.example.test'} : reader.exports}; vm.runInNewContext(compile(fs.readFileSync('components/referralApi.ts', 'utf8')), api);
let hooks = [], index = 0, effects = [], changed = false, tree, xpOpened = 0;
const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
const react = {
  createElement: (type, props, ...children) => ({type, props: props || {}, children: children.flat(Infinity)}),
  useState: value => {const i = index++; if (!(i in hooks)) hooks[i] = value; return [hooks[i], next => {hooks[i] = typeof next === 'function' ? next(hooks[i]) : next; changed = true;}];},
  useRef: value => {const i = index++; return hooks[i] || (hooks[i] = {current: value});},
  useCallback: (fn, deps) => {const i = index++; if (!hooks[i] || !same(hooks[i].deps, deps)) hooks[i] = {deps, fn}; return hooks[i].fn;},
  useEffect: (fn, deps) => {const i = index++; if (!hooks[i] || !same(hooks[i].deps, deps)) {const old = hooks[i]; hooks[i] = {deps}; effects.push(() => {old?.cleanup?.(); hooks[i].cleanup = fn();});}},
};
const component = {exports: {}, require: name => {
 if(name==='./ProviderPanel')return {ProviderPanel:'Modal'};
  if (name === 'react') return react;
  if (name === 'react-native') return {ActivityIndicator: 'Spinner', Modal: 'Modal', Pressable: 'Button', ScrollView: 'Scroll', View: 'View', Share: {share: async options => {shared.push(options);}}};
  if (name === 'react-native-safe-area-context') return {useSafeAreaInsets: () => ({top: 12, bottom: 16})};
  if (name === './AccountDesign') return {useAccountDesign: () => ({})};
  if (name === './ThemeProvider') return {ThemedText: 'Text'};
  if (name === './referralApi') return api.exports;
  throw Error('Unexpected ' + name);
}};
vm.runInNewContext(compile(fs.readFileSync('components/NativeReferrals.tsx', 'utf8')), component);
function render() {index = 0; effects = []; changed = false; tree = component.exports.NativeReferrals({token: 'current-account', onClose() {}, onOpenXP() {xpOpened++;}}); effects.forEach(fn => fn());}
const nodes = node => !node || typeof node !== 'object' ? [] : [node, ...(node.children || []).flatMap(nodes)]; const text = node => typeof node === 'string' || typeof node === 'number' ? String(node) : node?.children?.map(text).join('') || '';
const button = label => {const value = nodes(tree).find(n => n.type === 'Button' && text(n) === label); assert.ok(value, label); return value;};
async function settle() {for (let i = 0; i < 8; i++) {await new Promise(resolve => setImmediate(resolve)); if (changed) render();}}
(async () => {
  await api.exports.validateSignupReferral(''); assert.equal(calls.length, 0); await assert.rejects(api.exports.validateSignupReferral('short'), /12-character/); assert.equal(calls.length, 0);
  status = 404; await assert.rejects(api.exports.validateSignupReferral('ABCDEF123456'), /not available/); status = 200; body = {valid: false}; await assert.rejects(api.exports.validateSignupReferral('ABCDEF123456'), /unavailable/);
  body = {valid: true}; await api.exports.validateSignupReferral(' abcdef123456 '); assert.ok(calls.at(-1).url.endsWith('code=ABCDEF123456'));
  body = {code: 'ABCDEF123456'}; await assert.rejects(api.exports.loadReferralSummary('current-account'), /unavailable/);
  body = summary; calls.length = 0; render(); await settle(); assert.match(text(tree), /another 495 XP: 500 XP total/); assert.match(text(tree), /1,000 XP/);
  assert.equal(calls[0].init.headers.Authorization, 'Bearer current-account'); button('Share invitation').props.onPress(); await settle(); assert.match(shared[0].message, /ABCDEF123456/);
  button('View XP balance and withdrawals').props.onPress(); assert.equal(xpOpened, 1); assert.ok(calls.every(call => !call.init.method || call.init.method === 'GET'), 'screen never awards or withdraws money itself');
  let release; held = new Promise(resolve => {release = resolve;}); button('Refresh referrals').props.onPress(); button('Refresh referrals').props.onPress(); await settle(); const requests = calls.length;
  hooks.forEach(h => h?.cleanup?.()); changed = false; body = {...summary, code: 'FEDCBA654321'}; release(); held = null; await new Promise(resolve => setImmediate(resolve)); assert.equal(changed, false, 'late signed-out account results are ignored'); assert.equal(calls.length, requests);
  console.log('Referrals passed: normalized code validation, fail-closed unavailable backend, actual owned summary/UI/share, 5+495 policy, existing XP navigation and stale/single-flight protection.');
})().catch(error => {console.error(error); process.exitCode = 1;});
