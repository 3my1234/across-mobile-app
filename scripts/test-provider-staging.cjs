const assert = require('node:assert/strict');
const {resolveAPIEnvironment} = require('../components/apiEnvironment');
const {checkProviderStaging} = require('./check-provider-staging.cjs');
assert.equal(resolveAPIEnvironment(), 'https://api.atlxpres.com');
assert.equal(resolveAPIEnvironment('production', undefined, 'https://api.atlxpres.com'), 'https://api.atlxpres.com');
const env = {EXPO_PUBLIC_PROVIDER_STAGING_API_URL: 'https://staging-api.atlxpres.com', EXPO_PUBLIC_PRIVY_APP_ID: 'synthetic-app', EXPO_PUBLIC_PRIVY_CLIENT_ID: 'synthetic-client'};
assert.equal(checkProviderStaging(env).api_origin, 'https://staging-api.atlxpres.com');
for (const value of [undefined, '', 'http://staging-api.atlxpres.com', 'https://api.atlxpres.com', 'https://api.atlxpres.com/', 'https://provider.atlxpres.com', 'https://build-check.invalid','https://staging.example.test','https://example.com', 'https://localhost', 'https://10.77.0.1', 'https://user:secret@staging-api.atlxpres.com', 'https://staging-api.atlxpres.com/token?secret=x', 'https://staging-api.atlxpres.com:8080']) {
  assert.throws(() => checkProviderStaging({...env, EXPO_PUBLIC_PROVIDER_STAGING_API_URL: value}));
}
assert.throws(() => checkProviderStaging({...env, EXPO_PUBLIC_NATIVE_PROVIDER_ACCOUNT: 'false'}));
assert.throws(() => checkProviderStaging({...env, EXPO_PUBLIC_PRIVY_APP_ID: ''}));
assert.throws(() => checkProviderStaging({...env, EAS_BUILD_PROFILE: 'production'}));
assert.equal(resolveAPIEnvironment('staging', env.EXPO_PUBLIC_PROVIDER_STAGING_API_URL, 'https://api.atlxpres.com'), 'https://staging-api.atlxpres.com', 'staging never uses the normal production default');
console.log('Provider staging guard passed: missing/production/placeholder origins rejected, native flags required, auth configuration and application identity retained.');
