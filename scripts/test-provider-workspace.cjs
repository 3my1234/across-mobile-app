const fs=require('fs'),vm=require('vm'),ts=require('typescript'),assert=require('node:assert/strict');
const code=ts.transpileModule(fs.readFileSync('components/providerWorkspacePolicy.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const policyExports={};vm.runInNewContext(code,{exports:policyExports,URL,URLSearchParams});
assert.equal(policyExports.trustedProviderURL('https://provider.atlxpres.com/?view=messages'),true);
for(const url of ['http://provider.atlxpres.com','https://provider.atlxpres.com.evil.test','https://user@provider.atlxpres.com','javascript:alert(1)'])assert.equal(policyExports.trustedProviderURL(url),false);
const url=policyExports.providerWorkspaceURL('view=messages&conversation=11111111-1111-4111-8111-111111111111&token=secret&redirect=https://evil.test');assert.ok(!url.includes('secret'));assert.ok(!url.includes('evil'));assert.ok(url.includes('embedded=1'));
const init=policyExports.providerInitScript('test-session','dark','nonce');let called=0;const context={location:{origin:'https://evil.test'},window:{ATLProviderNativeStart:()=>called++}};vm.runInNewContext(init,context);assert.equal(called,0);context.location.origin='https://provider.atlxpres.com';context.window.ATLProviderNativeStart=data=>{assert.equal(data.token,'test-session');assert.equal(data.nonce,'nonce');called++};vm.runInNewContext(init,context);assert.equal(called,1);
for(const unsafe of ['javascript:alert(1)','file:///private','http://example.test'])assert.equal(policyExports.safeExternalURL(unsafe),false);
console.log('Provider workspace policy passed: exact trusted origin, no URL credentials, guarded session injection and safe external links.');
