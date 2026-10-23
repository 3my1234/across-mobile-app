const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
let hooks=[],index=0,intent='auto',mode='signup',tree;const submissions=[],alerts=[];
const react={createElement:(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity)})};
const useState=initial=>{const i=index++;if(!(i in hooks))hooks[i]=initial;return [hooks[i],value=>{hooks[i]=typeof value==='function'?value(hooks[i]):value;}];};
const source=fs.readFileSync('components/Screens.tsx','utf8');const part=source.slice(source.indexOf('export function AuthScreen('),source.indexOf('// ---- Product Detail Screen'));
const context={exports:{},React:react,useState,useEffect:()=>{},useRef:value=>({current:value}),useTheme:()=>({dark:false,color:value=>value}),useThemedStyles:()=>({}),sharedStyles:{},useSafeAreaInsets:()=>({top:0,bottom:0,left:0,right:0}),
 Keyboard:{addListener:()=>({remove(){}})},Platform:{OS:'android'},Alert:{alert:(...args)=>alerts.push(args)},COLORS:{primary:'#087B58'},MOBILE_AUTH_BACKGROUND:1,LOGO:1,setTimeout:()=>{},
 ImageBackground:'Background',View:'View',StatusBar:'StatusBar',KeyboardFrame:'KeyboardFrame',ScrollView:'Scroll',Image:'Image',Text:'Text',Pressable:'Button',TextInput:'Input',ActivityIndicator:'Spinner',Ionicons:'Icon'};
vm.runInNewContext(ts.transpileModule(part,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.React}}).outputText,context);
function render(){index=0;tree=context.exports.AuthScreen({mode,workspaceIntent:intent,onWorkspaceIntent:value=>{intent=value;},countryCode:'NG',buyerMarkets:[],onCountryChange(){},busy:false,googleReady:true,googleTimedOut:false,googleBusy:false,onModeChange:value=>{mode=value;},onSubmit:async(path,body)=>submissions.push({path,body}),onResend:async()=>{},onForgotPassword:async()=>{},onGoogle:async()=>{}});}
const nodes=n=>!n||typeof n!=='object'?[]:[n,...(n.children||[]).flatMap(nodes)],text=n=>typeof n==='string'?n:n?.children?.map(text).join('')||'';
const button=label=>{const n=nodes(tree).find(n=>n.type==='Button'&&text(n)===label);assert.ok(n,label);return n;};
function input(placeholder,value){const n=nodes(tree).find(n=>n.type==='Input'&&n.props.placeholder===placeholder);assert.ok(n,placeholder);n.props.onChangeText(value);}
(async()=>{
 render();assert.equal(nodes(tree).filter(n=>n.props.accessibilityRole==='radio').length,2);assert.ok(!nodes(tree).some(n=>n.type==='Input'),'registration asks workspace before personal details');
 nodes(tree).find(n=>n.props.accessibilityRole==='radio'&&text(n).startsWith('Provider')).props.onPress();render();assert.equal(intent,'provider');assert.ok(nodes(tree).some(n=>n.props.accessibilityState?.checked===true&&text(n).startsWith('Provider')));
 input('Full name','Synthetic owner');input('Email','owner@example.test');input('Phone','08000000000');input('Password','Password!123');render();await button('Continue').props.onPress();
 assert.equal(submissions.length,1);assert.equal(submissions[0].path,'/api/v1/auth/signup');assert.equal(submissions[0].body.email,'owner@example.test');assert.equal(submissions[0].body.role,undefined,'workspace choice must not grant a backend role');assert.equal(submissions[0].body.provider_type,undefined,'provider application remains an explicit post-auth step');
 intent='customer';render();await button('Continue').props.onPress();assert.equal(submissions[1].body.email,'owner@example.test','switching workspace must not create a second identity');
 input('Password','weak');render();await button('Continue').props.onPress();assert.equal(submissions.length,2);assert.match(alerts.at(-1)[0],/stronger password/);
 mode='signin';intent='auto';input('Password','Password!123');render();assert.equal(nodes(tree).filter(n=>n.props.accessibilityRole==='radio').length,0,'existing users are detected automatically');await button('Sign In').props.onPress();assert.equal(submissions.at(-1).path,'/api/v1/auth/login');
 console.log('Actual registration screen passed: Customer/Provider choice before form, visible selection, same identity payload, password validation and automatic existing-account sign-in.');
})().catch(error=>{console.error(error);process.exitCode=1;});
