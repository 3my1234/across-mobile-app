export type TierBenefits = {post_limit?: number; max_images: number; max_videos: number; max_video_seconds: number; town_hall: boolean; town_hall_room_limit?: number; town_hall_search?: boolean; direct_messaging?: boolean; recommended?: boolean; visibility: string; promotional_weight?: number};
export type TierUsage = {tier_label: string; active_listings_used: number; remaining_active_listings: number; town_hall_rooms_used: number; remaining_town_hall_rooms: number; listing_over_limit: boolean; room_over_limit: boolean; benefits: TierBenefits};
export const tierExplanation = 'Business verification is required. Your badge shows your paid plan, not a separate guarantee of trust or transport licensing. Promotion depends on relevance, availability and fair rotation. No plan guarantees inquiries, sales or a search position.';
export function tierBenefitLines(plan: {listing_limit?: number; post_policy?: TierBenefits}) {
 const policy=plan.post_policy;
 const lines: string[]=[];
 if(Number.isInteger(plan.listing_limit)) lines.push(`${plan.listing_limit} listings across products and services`);
 if(!policy) return lines;
 lines.push(`${policy.max_images} images per listing`);
 lines.push(policy.max_videos ? `Up to ${policy.max_videos} videos, ${policy.max_video_seconds} seconds each` : 'No videos');
 if(policy.town_hall) lines.push(policy.town_hall_room_limit === undefined ? 'Town Hall included' : `Join up to ${policy.town_hall_room_limit} Town Hall requests at once`);
 else lines.push('Provider Town Hall participation unavailable');
 if(policy.town_hall_search) lines.push('Town Hall search, category and location filters');
 if(policy.direct_messaging) lines.push('Direct customer messaging');
 if(policy.recommended) lines.push('Eligible for relevant Recommended listings');
 lines.push(`${policy.visibility.replace(/_/g,' ')} promoted exposure${policy.promotional_weight ? ` (relative weight ${policy.promotional_weight})` : ''}`);
 return lines;
}
export function tierUsageLines(usage: TierUsage) {
 return [`${usage.tier_label}: ${usage.active_listings_used} / ${usage.benefits.post_limit} listing places used; ${usage.remaining_active_listings} available.`,`${usage.town_hall_rooms_used} / ${usage.benefits.town_hall_room_limit} Town Hall requests joined; ${usage.remaining_town_hall_rooms} available.`,...(usage.listing_over_limit || usage.room_over_limit ? ['Your existing listings, media and joined requests are kept. Archive listings or leave requests, or upgrade, before adding more.'] : []),'Products and services share one allowance. Unarchived drafts reserve a place. Each request still has its own provider capacity.'];
}
