const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript'), assert = require('node:assert/strict');
let hooks = [], index = 0, effects = [], changed = false, tree, saved = 0, held, fail = false;
const calls = [];
const react = {
  createElement: (type, props, ...children) => ({type, props: props || {}, children: children.flat(Infinity)}),
  useState: initial => {const i = index++; if (!(i in hooks)) hooks[i] = typeof initial === 'function' ? initial() : initial; return [hooks[i], next => {hooks[i] = typeof next === 'function' ? next(hooks[i]) : next; changed = true;}];},
  useRef: initial => {const i = index++; return hooks[i] || (hooks[i] = {current: initial});},
  useEffect: fn => {const i = index++; if (!(i in hooks)) {hooks[i] = {}; effects.push(() => {hooks[i].cleanup = fn();});}},
};
const compile = path => ts.transpileModule(fs.readFileSync(path, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React, esModuleInterop: true}}).outputText;
const policy = {}; vm.runInNewContext(compile('components/providerOnboardingPolicy.ts'), {exports: policy, URL});
const context = {exports: {}, require: name => {
  if (name === 'react') return react;
  if (name === 'react-native') return {ActivityIndicator: 'Spinner', Pressable: 'Button', Switch: 'Switch', View: 'View'};
  if (name === './ThemeProvider') return {ThemedText: 'Text', ThemedTextInput: 'Input'};
  if (name === './AccountDesign') return {useAccountDesign: () => ({})};
  if (name === './providerOnboardingPolicy') return policy;
  if (name === './nativeProviderApi') return {providerRequest: async (token, path, options) => {calls.push({token, path, ...options}); if (held) await held; if (fail) throw Error('Synthetic submission not confirmed'); return {id: 'synthetic-business'};}};
  throw Error('Unexpected import ' + name);
}};
vm.runInNewContext(compile('components/NativeProviderOnboarding.tsx'), context);
function render() {index = 0; effects = []; changed = false; tree = context.exports.NativeProviderOnboarding({token: 'new-verified-owner', onSaved: async isDriver => {assert.equal(isDriver, true);saved++;}, onRefresh() {}}); effects.forEach(fn => fn());}
const nodes = node => !node || typeof node !== 'object' ? [] : [node, ...(node.children || []).flatMap(nodes)];
const text = node => typeof node === 'string' ? node : node?.children?.map(text).join('') || '';
const submit = () => nodes(tree).find(n => n.type === 'Button' && text(n) === 'Submit provider profile');
async function settle() {for (let i = 0; i < 6; i++) {await new Promise(resolve => setImmediate(resolve)); if (changed) render();}}
(async () => {
  render(); submit().props.onPress(); await settle(); assert.equal(calls.length, 0, 'invalid business cannot be submitted');
  for (const [label, value] of [['Business name', 'Synthetic business'], ['Business contact email', 'owner@example.test'], ['Business contact phone', '+2340000000000'], ['City', 'Lagos'], ['State / region', 'Lagos']]) nodes(tree).find(n => n.props.accessibilityLabel === label).props.onChangeText(value);
  nodes(tree).find(n => n.props.accessibilityRole === 'radio').props.onPress(); nodes(tree).find(n => n.type === 'Switch').props.onValueChange(true); render();
  assert.match(text(tree), /driver licence, your car and the plate number/);
  let release; held = new Promise(resolve => {release = resolve;});
  submit().props.onPress(); submit().props.onPress(); await settle(); assert.equal(calls.length, 1, 'double tap submits once'); assert.equal(submit().props.disabled, true);
  assert.equal(calls[0].token, 'new-verified-owner'); assert.equal(calls[0].path, '/providers/onboarding');
  const payload = JSON.parse(calls[0].body); assert.equal(payload.business_name, 'Synthetic business'); assert.equal(payload.is_driver, true); assert.equal(payload.user_id, undefined); assert.equal(payload.verification_status, undefined);
  release(); held = null; await settle(); assert.equal(saved, 1, 'server-confirmed submission refreshes existing provider state');
  fail = true; submit().props.onPress(); await settle(); assert.match(text(tree), /refresh account access before submitting again/i); assert.equal(saved, 1);
  const attempts = calls.length; await settle(); assert.equal(calls.length, attempts, 'uncertain application is not automatically replayed');
  hooks.forEach(h => h?.cleanup?.());
  console.log('Actual onboarding screen passed: required fields, category and driver evidence, same identity, single-flight submission, server-confirmed continuation and failure without replay.');
})().catch(error => {console.error(error); process.exitCode = 1;});
