const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),ts=require("typescript");
const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,"../components/theme.ts"),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const g={exports:{},Map,Object};vm.runInNewContext(code,g);const {themeColor,themeStyles}=g.exports;
function luminance(hex){let c=hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;}
function contrast(a,b){let x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
for(const [text,bg] of [["#191919","#FFF"],["#66736F","#F3F4F4"],["#B42318","#FFF1F1"],["#315B3B","#EAF8F2"],["#B54708","#FFF1DD"]])assert.ok(contrast(themeColor(text,"color",true),themeColor(bg,"backgroundColor",true))>=4.5,`${text}/${bg} must be readable`);
for(const colour of ["#FF4747","#FFB400"])for(const role of ["color","backgroundColor","borderColor"])assert.equal(themeColor(colour,role,true),colour,"preserve brand and stars");
assert.equal(themeColor("#FFF","color",true),"#FFF","white overlay/button text");assert.equal(themeColor("#000000","backgroundColor",true),"#000000","photo viewer stays black");
assert.equal(themeColor("#D71920","backgroundColor",true),"#D71920","discount badge needs its red background");
const base={field:{color:"#191919",backgroundColor:"#FFF",borderColor:"#EEE",fontSize:14},button:{backgroundColor:"#FF4747",color:"#FFF"}};
assert.equal(themeStyles(base,false),base);const dark=themeStyles(base,true);assert.equal(base.field.color,"#191919");assert.notEqual(dark.field.color,base.field.color);assert.equal(dark.field.fontSize,14);assert.equal(dark.button.backgroundColor,"#FF4747");
console.log("Theme contrast passed: text, muted copy, input surfaces, status messages, yellow stars, brand, badges and photo overlays.");

const config=JSON.parse(fs.readFileSync(path.join(__dirname,"../app.json"),"utf8"));assert.equal(config.expo.userInterfaceStyle,"automatic","Android must receive system appearance changes");
