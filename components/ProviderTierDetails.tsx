import React from 'react';
import {View} from 'react-native';
import {ThemedText as Text} from './ThemeProvider';
import {tierBenefitLines, tierUsageLines, TierBenefits, TierUsage} from './providerTierBenefits';
export function ProviderTierDetails({plan}: {plan:{listing_limit?:number;post_policy?:TierBenefits}}) {return <View style={{gap:6}}>{tierBenefitLines(plan).map(line=><Text key={line}>{line}</Text>)}</View>;}
export function ProviderTierUsage({usage}: {usage:TierUsage|null}) {return usage ? <View style={{gap:6}}>{tierUsageLines(usage).map(line=><Text key={line}>{line}</Text>)}</View> : null;}
