const assert=require('node:assert/strict');
const {checkPlayDistribution}=require('./check-release-distribution.cjs');
const env={EXPO_PUBLIC_PRIVY_APP_ID:'synthetic-public-id',EXPO_PUBLIC_PRIVY_CLIENT_ID:'synthetic-client-id'};
assert.equal(checkPlayDistribution(env).artifact,'aab');
for(const overrides of [{EXPO_PUBLIC_DISTRIBUTION_CHANNEL:'direct'},{EXPO_PUBLIC_NATIVE_PROVIDER_ACCOUNT:'false'},{EXPO_PUBLIC_API_URL:'https://unreviewed.invalid'},{EXPO_PUBLIC_APP_ENV:'preview'},{EXPO_PUBLIC_PRIVY_APP_ID:''}])assert.throws(()=>checkPlayDistribution({...env,...overrides}));
console.log('Play distribution guard PASS: existing AAB identity/native flag, distinct production configuration, conflicting direct/preview builds rejected.');
