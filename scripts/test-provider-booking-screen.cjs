const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript'), assert = require('node:assert/strict');
let hooks = [], index = 0, effects = [], changed = false, tree, status = 'pending', alert, held, fail = false;
const calls = [], same = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
const react = {
  createElement: (type, props, ...children) => ({type, props: props || {}, children: children.flat(Infinity)}),
  useRef: value => {const i = index++; return hooks[i] || (hooks[i] = {current: value});},
  useState: value => {const i = index++; if (!(i in hooks)) hooks[i] = typeof value === 'function' ? value() : value; return [hooks[i], next => {hooks[i] = typeof next === 'function' ? next(hooks[i]) : next; changed = true;}];},
  useEffect: (fn, deps) => {const i = index++; if (!hooks[i] || !same(hooks[i].deps, deps)) {const previous = hooks[i]; hooks[i] = {deps}; effects.push(() => {previous?.cleanup?.(); hooks[i].cleanup = fn();});}},
  useCallback: (fn, deps) => {const i = index++; if (!hooks[i] || !same(hooks[i].deps, deps)) hooks[i] = {deps, fn}; return hooks[i].fn;},
};
const policy = {};
const compile = path => ts.transpileModule(fs.readFileSync(path, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React, esModuleInterop: true}}).outputText;
vm.runInNewContext(compile('components/providerBookingPolicy.ts'), {exports: policy});
const request = async (token, path, options = {}) => {
  calls.push({token, path, ...options});
  if (options.method === 'PATCH') {if (held) await held.promise; if (fail) throw Error('Request status changed'); status = JSON.parse(options.body).status; return {};}
  return {items: [{id: '33333333-3333-4333-8333-333333333333', status, listing_title: 'Synthetic repair', request_type: 'appointment', party_size: 1, buyer: {full_name: 'Test buyer'}}], next_cursor: ''};
};
const context = {exports: {}, URLSearchParams, require: name => {
  if (name === 'react') return react;
  if (name === 'react-native') return {ActivityIndicator: 'Spinner', Alert: {alert: (...args) => {alert = args;}}, Modal: 'Modal', Pressable: 'Button', ScrollView: 'ScrollView', View: 'View'};
  if (name === 'react-native-safe-area-context') return {useSafeAreaInsets: () => ({top: 0, bottom: 16})};
  if (name === './ThemeProvider') return {ThemedText: 'Text', ThemedTextInput: 'Input'};
  if (name === './AccountDesign') return {useAccountDesign: () => ({})};
  if (name === './KeyboardFrame') return {KeyboardFrame: 'Frame'};
  if (name === './providerBookingImages') return {loadBookingImages: async () => {}};
  if (name === './ProviderPostImages') return {ProviderPostImages: 'Gallery'};
  if (name === './nativeProviderApi') return {providerRequest: request};
  if (name === './providerBookingPolicy') return policy;
  throw Error('Unexpected import '+name);
}};
vm.runInNewContext(compile('components/NativeProviderRequests.tsx'), context);
function render() {index = 0; effects = []; changed = false; tree = context.exports.NativeProviderRequests({token: 'synthetic-owner', onClose() {}}); effects.forEach(fn => fn());}
async function settle() {for (let i = 0; i < 8; i++) {await new Promise(resolve => setImmediate(resolve)); if (changed) render();}}
function nodes(node) {return !node || typeof node !== 'object' ? [] : [node, ...(node.children || []).flatMap(nodes)];}
const text = node => typeof node === 'string' ? node : node?.children?.map(text).join('') || '';
function button(label) {const value = nodes(tree).find(node => node.type === 'Button' && text(node) === label); assert.ok(value, 'missing '+label); return value;}
const patches = () => calls.filter(call => call.method === 'PATCH');
(async () => {
  render(); await settle(); assert.ok(text(tree).includes('Synthetic repair'));
  button('Accept').props.onPress(); assert.equal(patches().length, 0, 'confirmation is required before the mutation');
  assert.match(alert[0], /Accept/);
  let release; held = {promise: new Promise(resolve => {release = resolve;})};
  const confirm = alert[2].find(item => item.text === 'Confirm').onPress;
  confirm(); confirm(); await settle(); assert.equal(patches().length, 1, 'double confirmation makes one mutation');
  assert.equal(patches()[0].token, 'synthetic-owner'); assert.equal(JSON.parse(patches()[0].body).status, 'accepted');
  assert.equal(button('Accept').props.disabled, true, 'actions remain disabled until the server completes');
  release(); held = null; await settle(); assert.ok(!nodes(tree).some(node => node.type === 'Button' && text(node) === 'Accept'));
  button('Complete').props.onPress(); assert.match(alert[0], /Complete/);
  fail = true; alert[2].find(item => item.text === 'Confirm').onPress(); await settle();
  assert.equal(status, 'accepted', 'failed completion cannot optimistically change the status');
  assert.ok(text(tree).includes('Refresh before trying again'));
  const count = patches().length; await settle(); assert.equal(patches().length, count, 'ambiguous mutation is never automatically replayed');
  hooks.forEach(hook => hook?.cleanup?.());
  console.log('Native booking screen passed: real component loading, confirmation, double-tap protection, same-account request, server-confirmed transition and failure without replay.');
})().catch(error => {console.error(error); process.exitCode = 1;});
