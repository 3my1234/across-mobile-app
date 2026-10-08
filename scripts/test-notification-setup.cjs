/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const transpile = code => ts.transpileModule(code, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
async function main() {
  const utils = vm.createContext({exports:{},require:()=>({}),process:{env:{}}});
  vm.runInContext(transpile(read('components/utils.ts')), utils);
  assert.doesNotMatch(utils.exports.money(25000), /\.00/);
  assert.match(utils.exports.money(110.10), /110\.1/);
  assert.match(utils.exports.money(110.01), /110\.01/);
  assert.equal(utils.exports.money(25000, 'invalid'), 'invalid 25000');
  assert.equal(utils.exports.money(0, 'invalid'), 'invalid 0');
  assert.equal(utils.exports.money(110.10, 'invalid'), 'invalid 110.1');
  const screens = read('components/Screens.tsx');
  let selected='overview', jumps=[];
  const navigation=vm.createContext({sectionJump:{current:false},sectionOffsets:{current:{overview:600,reviews:250,recommended:1200}},
    setActiveSection:value=>{selected=value;},detailScrollRef:{current:{scrollTo:value=>jumps.push(value)}}});
  const start=screens.indexOf('  function scrollToSection(');
  vm.runInContext(transpile(screens.slice(start,screens.indexOf('\n  }',start)+4)),navigation);
  navigation.scrollToSection('recommended');
  assert.equal(selected,'recommended');
  assert.equal(jumps[0].y,1800);
  assert.equal(jumps[0].animated,false,'a tab tap must jump directly without traversing earlier sections');
  const handler=screens.match(/onScroll=\{(event=>\{if\(sectionJump.current\)return;[^\n]+?setActiveSection\(section\);\})\}/)[1];
  vm.runInContext('var scrollHandler='+transpile('const scrollHandler='+handler).replace('const scrollHandler =','').trim().replace(/;$/,''),navigation);
  navigation.scrollHandler({nativeEvent:{contentOffset:{y:50}}});
  assert.equal(selected,'recommended','a queued pre-jump event must not change the selected tab');
  navigation.sectionJump.current=false;
  navigation.scrollHandler({nativeEvent:{contentOffset:{y:850}}});
  assert.equal(selected,'reviews','manual scrolling must resume section tracking');
  navigation.sectionOffsets.current.overview=700;
  navigation.scrollToSection('recommended');
  assert.equal(jumps.at(-1).y,1900,'image/layout height changes must use the current parent offset');
  const app = read('App.tsx');
  let status='', posts=[], fail=true, muted=false, concurrent=0, maximum=0;
  const state = {
    Platform:{OS:'android'},soundPreferenceVersion:{current:0},sessionTokenRef:{current:'buyer'},
    readNotificationSoundEnabled:async()=>true,pushSetupFlight:{current:null},pushSetupLastSuccess:{current:null},pushTokenRef:{current:null},
    Notifications:{AndroidImportance:{MAX:5,DEFAULT:3},setNotificationChannelAsync:async()=>{},getPermissionsAsync:async()=>({status:'granted'}),
      getExpoPushTokenAsync:async()=>({data:'expo-token'}),getNotificationChannelAsync:async()=>({sound:muted?null:'default',importance:5})},
    Constants:{expoConfig:{extra:{eas:{projectId:'project'}}}},API_URL:'https://example.test',setNotificationStatus:value=>{status=value;},
    fetchJSONWithTimeout:async(_,init)=>{posts.push(JSON.parse(init.body));concurrent++;maximum=Math.max(maximum,concurrent);await new Promise(resolve=>setTimeout(resolve,5));concurrent--;return {response:{ok:!fail},body:{}};},
    Date,Promise
  };
  const context=vm.createContext(state);
  vm.runInContext(transpile(app.slice(app.indexOf('  async function registerPushNotifications('), app.indexOf('  async function markNotificationRead('))),context);
  assert.equal(await context.registerPushNotifications('buyer'),false);
  assert.equal(state.pushSetupLastSuccess.current,null,'failed registration must remain retryable');
  fail=false;
  await Promise.all([context.registerPushNotifications('buyer'),context.registerPushNotifications('buyer')]);
  assert.equal(posts.length,2,'concurrent retry should share a successful registration');
  assert.equal(maximum,1);
  muted=true;
  assert.equal(await context.registerPushNotifications('buyer',undefined,true),true);
  assert.match(status,/Phone settings silence/,'report an OS-muted channel without claiming it is fixed');
  const first=context.registerPushNotifications('buyer',true,true);
  await new Promise(resolve=>setTimeout(resolve,1));
  state.soundPreferenceVersion.current++;
  const latest=context.registerPushNotifications('buyer',false);
  await Promise.all([first,latest]);
  assert.equal(posts.at(-1).sound_enabled,false,'latest preference must win');
  assert.equal(maximum,1,'preference updates must never POST concurrently');
  const count=posts.length;
  state.sessionTokenRef.current='other-buyer';
  assert.equal(await context.registerPushNotifications('buyer',true,true),false);
  assert.equal(posts.length,count,'stale sessions must not register tokens');
  console.log('Whole/fractional prices, push-registration retries, muted-channel diagnostics, serialized preferences and stale-session regressions passed.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
