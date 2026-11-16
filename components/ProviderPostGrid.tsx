import React, {useState} from 'react';
import {Modal, Pressable, ScrollView, View, useWindowDimensions} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ThemedText as Text} from './ThemeProvider';
import {useAccountDesign} from './AccountDesign';
import {ResilientImage} from './ResilientImage';
import {ListingMediaGallery} from './ListingMediaGallery';
import type {ProviderPost} from './providerPublishingPolicy';

export function ProviderPostGrid({items, kind, busy, onEdit, onArchive, onSubmit, onAvailability}: {items: ProviderPost[]; kind: 'products' | 'listings'; busy: boolean; onEdit: (item: ProviderPost) => void; onArchive: (item: ProviderPost) => void; onSubmit: (item: ProviderPost) => void; onAvailability: (item: ProviderPost) => void}) {
  const c = useAccountDesign(), inset = useSafeAreaInsets(), screen = useWindowDimensions();
  const [actions, setActions] = useState<ProviderPost | null>(null), [media, setMedia] = useState<ProviderPost | null>(null);
  const photos = (item: ProviderPost): string[] => kind === 'products' ? item.image_urls || [] : item.media_urls || [];
  const videos = (item: ProviderPost): string[] => kind === 'products' ? item.video_urls || [] : item.attributes?.video_urls || [];
  const status = (item: ProviderPost) => (kind === 'products' ? item.moderation_status : item.status) || 'draft';
  const noun = kind === 'products' ? 'product' : 'service';
  const color = (value: string) => value === 'approved' ? c.accent : value === 'pending' ? '#F5CF65' : ['rejected', 'suspended'].includes(value) ? c.danger : c.muted;
  const action = (label: string, icon: keyof typeof Ionicons.glyphMap, fn: () => void, danger = false) => <Pressable accessibilityRole="button" disabled={busy} onPress={() => {setActions(null); fn();}} style={{minHeight: 54, paddingVertical: 13, flexDirection: 'row', gap: 12, alignItems: 'center', borderBottomWidth: 1, borderColor: c.line}}><Ionicons name={icon} size={22} color={danger ? c.danger : c.text}/><Text style={{flex: 1, fontWeight: '700', color: danger ? c.danger : c.text}}>{label}</Text><Ionicons name="chevron-forward" size={18} color={c.muted}/></Pressable>;
  return <>
    <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 12}}>{items.map(item => <View key={item.id} style={{width: '47%', flexGrow: 1, maxWidth: '49%', borderWidth: 1, borderColor: c.line, borderRadius: 16, overflow: 'hidden', backgroundColor: c.surface}}>
      <Pressable accessibilityRole="button" accessibilityLabel={`View media for ${item.title}`} disabled={busy} onPress={() => setMedia(item)}>
        <ResilientImage uri={photos(item)[0] || ''} fallbackUri="" resizeMode="cover" style={{width: '100%', aspectRatio: 1}}/>
        <View style={{position: 'absolute', right: 8, top: 8, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, padding: 5, backgroundColor: '#0009'}}><Ionicons name="images-outline" size={15} color="#FFF"/><Text style={{color: '#FFF', fontSize: 12}}>{photos(item).length}</Text>{videos(item).length > 0 && <Ionicons name="videocam-outline" size={15} color="#FFF"/>}</View>
      </Pressable>
      <View style={{padding: 10, gap: 6}}><Text numberOfLines={2} style={{fontWeight: '700', minHeight: 36}}>{item.title || 'Untitled draft'}</Text><View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4}}><View style={{flexShrink: 1, borderWidth: 1, borderColor: color(status(item)), borderRadius: 16, paddingHorizontal: 8, paddingVertical: 4}}><Text numberOfLines={1} style={{fontSize: 12, color: color(status(item)), textTransform: 'capitalize'}}>{status(item)}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={`Actions for ${item.title}`} disabled={busy} hitSlop={4} onPress={() => setActions(item)} style={{minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center'}}><Ionicons name="ellipsis-horizontal" size={24} color={c.text}/></Pressable></View></View>
    </View>)}</View>
    {actions && <Modal transparent animationType="slide" onRequestClose={() => setActions(null)}><View style={{flex: 1, justifyContent: 'flex-end', backgroundColor: '#0008'}}><Pressable accessibilityRole="button" accessibilityLabel="Close product actions" style={{flex: 1}} onPress={() => setActions(null)}/><View accessibilityViewIsModal style={{backgroundColor: c.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: inset.bottom + 20}}><View style={{alignSelf: 'center', width: 48, height: 5, borderRadius: 3, backgroundColor: c.muted, marginBottom: 16}}/><Text style={{fontSize: 22, fontWeight: '700'}}>{actions.title}</Text>{!!actions.moderation_notes && <Text style={{color: c.danger, marginTop: 8}}>{actions.moderation_notes}</Text>}{action('View media', 'images-outline', () => setMedia(actions))}{status(actions) !== 'archived' && action(`Edit ${noun}`, 'create-outline', () => onEdit(actions))}{['draft', 'rejected'].includes(status(actions)) && action('Submit for review', 'checkmark-circle-outline', () => onSubmit(actions))}{kind === 'listings' && status(actions) !== 'archived' && action('Add availability', 'calendar-outline', () => onAvailability(actions))}{status(actions) !== 'archived' && action(`Archive ${noun}`, 'archive-outline', () => onArchive(actions), true)}</View></View></Modal>}
    {media && <Modal animationType="slide" onRequestClose={() => setMedia(null)}><View style={{flex: 1, paddingTop: inset.top, paddingBottom: inset.bottom, backgroundColor: c.background}}><Pressable accessibilityRole="button" accessibilityLabel="Close listing media" onPress={() => setMedia(null)} style={{padding: 16, minHeight: 48}}><Text style={{color: c.accent}}>Close media</Text></Pressable><ScrollView><Text style={{padding: 16, fontSize: 20, fontWeight: '700'}}>{media.title}</Text>{photos(media).length + videos(media).length > 0 ? <ListingMediaGallery key={media.id} images={photos(media)} videos={videos(media)} width={screen.width} height={Math.max(220, screen.height * .55)}/> : <Text style={{padding: 16}}>No media uploaded.</Text>}</ScrollView></View></Modal>}
  </>;
}
