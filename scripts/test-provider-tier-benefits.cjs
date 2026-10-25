const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const load=path=>{const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,URL,Error});return exports;};
const benefits=load('components/providerTierBenefits.ts'),publishing=load('components/providerPublishingPolicy.ts');
for(const [tier,posts,images,rooms,weight]of[['Bronze',3,3,3,1],['Silver',10,5,5,2],['Diamond',25,8,8,3],['Gold',60,12,10,5]]){
 const policy={post_limit:posts,max_images:images,max_videos:0,max_video_seconds:60,town_hall:true,town_hall_room_limit:rooms,town_hall_search:true,direct_messaging:true,recommended:true,visibility:'standard',promotional_weight:weight};
 const lines=benefits.tierBenefitLines({listing_limit:posts,post_policy:policy}).join('|');for(const expected of[posts+' listings',images+' images',rooms+' Town Hall',String(weight)+')','location filters','Direct customer messaging','Recommended'])assert.ok(lines.includes(expected),tier+': '+expected);
 const usage=benefits.tierUsageLines({tier_label:tier,active_listings_used:posts+1,remaining_active_listings:0,town_hall_rooms_used:rooms,remaining_town_hall_rooms:0,listing_over_limit:true,benefits:policy}).join('|');assert.ok(usage.includes('kept'));assert.ok(usage.includes('/ '+posts));
}
assert.equal(benefits.tierBenefitLines({listing_limit:5}).length,1,'older APIs must not advertise new unimplemented benefits');
const policy={max_images:3,max_videos:0};const snapshot=publishing.editablePostSnapshot('products',{id:'same',image_urls:['a','b','c','d'],video_urls:['v']},'same');
assert.equal(publishing.postMediaError(policy,snapshot.image_urls,snapshot.video_urls,snapshot._retained_images,snapshot._retained_videos),'');
assert.match(publishing.postMediaError(policy,['a','b','c','new'],[],snapshot._retained_images,[]),/allows/);
assert.equal(publishing.postMediaError(policy,['a','b','d'],[],snapshot._retained_images,[]),'');
const payload=publishing.postPayload('products',snapshot);assert.equal(payload._retained_images,undefined);assert.equal(payload._retained_videos,undefined);assert.equal(snapshot._retained_images.length,4);
console.log('Server tier benefits, legacy fallback, usage and downgrade media checks passed.');
