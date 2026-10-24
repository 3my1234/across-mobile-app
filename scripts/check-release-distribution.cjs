const {spawnSync}=require('node:child_process');
const eas=require('../eas.json'),app=require('../app.json').expo;

function checkPlayDistribution(env=process.env){
 const p=eas.build.production;
 if(p?.android?.buildType!=='app-bundle'||p.distribution==='internal'||p.autoIncrement!==true||eas.cli.appVersionSource!=='remote')throw Error('Play requires an AAB and remotely incremented version code.');
 const expected={EXPO_PUBLIC_APP_ENV:'production',EXPO_PUBLIC_DISTRIBUTION_CHANNEL:'play',EXPO_PUBLIC_NATIVE_PROVIDER_ACCOUNT:'true',EXPO_PUBLIC_API_URL:'https://api.atlxpres.com'};
 for(const [key,value]of Object.entries(expected))if(p.env?.[key]!==value||(env[key]!==undefined&&env[key]!==value))throw Error(`Production distribution conflict: ${key}.`);
 if(app.android?.package!=='com.atlanticexpress.mobile'||app.scheme!=='across')throw Error('Existing application identity or return scheme changed.');
 for(const key of ['EXPO_PUBLIC_PRIVY_APP_ID','EXPO_PUBLIC_PRIVY_CLIENT_ID'])if(!String(env[key]||'').trim())throw Error(`Configure ${key} for the production build environment.`);
 return {distribution_configuration:'pass',application_id:app.android.package,artifact:'aab',native_provider:true,note:'Configuration only. Store billing, published privacy/deletion pages, actual signing/target API, backend readiness and device/Play acceptance remain separate gates.'};
}
if(require.main===module){
 if(process.env.EAS_BUILD_PROFILE==='production'){
  try{console.log(JSON.stringify(checkPlayDistribution()));}catch(error){console.error(error.message);process.exitCode=1;}
 }else{
  const child=spawnSync(process.execPath,['scripts/check-provider-staging.cjs','--eas-hook'],{stdio:'inherit',env:process.env});
  if(child.error){console.error('Could not run the existing provider build guard.');process.exitCode=1;}else process.exitCode=child.status??1;
 }
}
module.exports={checkPlayDistribution};
