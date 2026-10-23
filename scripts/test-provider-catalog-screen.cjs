const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript'), assert = require('node:assert/strict');
let hooks = [], index = 0, effects = [], changed = false, tree, kind = 'products';
const calls = [], photos = Array.from({length: 8}, (_, i) => `https://media.example.test/photo-${i}.jpg`);
const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
const react = {
  createElement: (type, props, ...children) => ({type, props: props || {}, children: children.flat(Infinity)}),
  useState: initial => {const i = index++; if (!(i in hooks)) hooks[i] = typeof initial === 'function' ? initial() : initial; return [hooks[i], next => {hooks[i] = typeof next === 'function' ? next(hooks[i]) : next; changed = true;}];},
  useRef: initial => {const i = index++; return hooks[i] || (hooks[i] = {current: initial});},
  useEffect: (fn, deps) => {const i = index++; if (!hooks[i] || !same(hooks[i].deps, deps)) {const old = hooks[i]; hooks[i] = {deps}; effects.push(() => {old?.cleanup?.(); hooks[i].cleanup = fn();});}},
  useCallback: (fn, deps) => {const i = index++; if (!hooks[i] || !same(hooks[i].deps, deps)) hooks[i] = {deps, fn}; return hooks[i].fn;},
};
const modules = {
  react,
  'react-native': {ActivityIndicator: 'Spinner', Alert: {alert() {}}, Linking: {}, Modal: 'Modal', Pressable: 'Button', ScrollView: 'Scroll', StyleSheet: {create: value => value}, Switch: 'Switch', View: 'View'},
  'expo-image-picker': {},
  'react-native-safe-area-context': {useSafeAreaInsets: () => ({top: 12, bottom: 16})},
  './ThemeProvider': {ThemedText: 'Text', ThemedTextInput: 'Input'},
  './AccountDesign': {useAccountDesign: () => ({})},
  './nativeProviderApi': {providerRequest: async (token, path, options) => {
    calls.push({token, path, options});
    if (path === '/providers/me/post-policy') return {post_limit: 20, max_images: 8, max_videos: 2, max_video_seconds: 60};
    return {items: [{id: 'synthetic-post', title: 'Existing business post', image_urls: photos, media_urls: photos.slice(0, 2), moderation_status: 'approved', status: 'approved'}]};
  }},
  './providerPublishingPolicy': {}, './providerAddressSearch': {}, './nativeProviderPolicy': {}, './foregroundLocation': {},
  './NativeProviderLocationPicker': {}, './NativeProviderAvailability': {}, './NativeProviderProductOptions': {}, './NativeProviderDeliveryOffer': {},
  './ResilientImage': {ResilientImage: 'Photo'}, './KeyboardFrame': {KeyboardFrame: 'Frame'},
  './ProviderPostImages': {ProviderPostImages: 'Gallery'},
};
function load(path) {
  const context = {exports: {}, URLSearchParams, require: name => {assert.ok(name in modules, name); return modules[name];}};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React, esModuleInterop: true}}).outputText, context);
  return context.exports;
}
const {NativeProviderCatalog} = load('components/NativeProviderCatalog.tsx');
const {ProviderPostImages} = load('components/ProviderPostImages.tsx');
const nodes = node => !node || typeof node !== 'object' ? [] : [node, ...(node.children || []).flatMap(nodes)];
const text = node => typeof node === 'string' || typeof node === 'number' ? String(node) : node?.children?.map(text).join('') || '';
function reset() {hooks.forEach(h => h?.cleanup?.()); hooks = []; index = 0; effects = []; calls.length = 0;}
function render() {index = 0; effects = []; changed = false; tree = NativeProviderCatalog({token: 'synthetic-owner', kind, provider: {id: 'synthetic-business'}, onClose() {}}); effects.forEach(fn => fn());}
async function settle() {for (let i = 0; i < 6; i++) {await new Promise(resolve => setImmediate(resolve)); if (changed) render();}}
(async () => {
  for (kind of ['products', 'listings']) {
    reset(); render(); await settle();
    const gallery = nodes(tree).find(n => n.type === 'Gallery'); assert.ok(gallery, 'existing posts show a gallery');
    assert.deepEqual(gallery.props.urls, kind === 'products' ? photos : photos.slice(0, 2));
    assert.equal(gallery.props.title, 'Existing business post');
    assert.ok(calls.some(call => call.path.startsWith(`/providers/me/${kind}?`)));
    assert.ok(calls.every(call => call.token === 'synthetic-owner' && !call.options?.method), 'image previews only read the existing owner catalogue');
  }
  reset();
  const draw = urls => {index = 0; return ProviderPostImages({urls, title: 'Existing business post'});};
  tree = draw([...photos, photos[0], '']);
  assert.equal(nodes(tree).filter(n => n.type === 'Photo').length, 8, 'all eight uploaded photos remain accessible, with duplicates/blank entries omitted');
  const last = nodes(tree).find(n => n.props.accessibilityLabel === 'View Existing business post image 8 of 8');
  last.props.onPress(); tree = draw(photos);
  const modal = nodes(tree).find(n => n.type === 'Modal'); assert.ok(modal);
  const full = nodes(modal).find(n => n.type === 'Photo'); assert.equal(full.props.uri, photos[7]); assert.equal(full.props.resizeMode, 'contain');
  assert.ok(nodes(tree).filter(n => n.type === 'Photo').every(n => n.props.fallbackUri === ''), 'never replace an actual product image with unrelated stock imagery');
  modal.props.onRequestClose(); tree = draw(photos); assert.ok(!nodes(tree).some(n => n.type === 'Modal'), 'Android back closes the enlarged image');
  reset(); assert.match(text(draw(undefined)), /No images uploaded/);
  console.log('Provider catalogue screen passed: owner product/service reads, existing photo mapping, eight-image gallery, enlargement, Android back and honest empty state.');
})().catch(error => {console.error(error); process.exitCode = 1;});
