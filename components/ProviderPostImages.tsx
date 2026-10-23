import React, {useState} from 'react';
import {Modal, Pressable, ScrollView, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ThemedText as Text} from './ThemeProvider';
import {useAccountDesign} from './AccountDesign';
import {ResilientImage} from './ResilientImage';

export function ProviderPostImages({urls, title}: {urls?: string[]; title: string}) {
  const c = useAccountDesign(), insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<string | null>(null);
  const photos = Array.from(new Set((urls || []).filter(url => typeof url === 'string' && url.trim())));
  if (!photos.length) return <Text>No images uploaded</Text>;
  return <View style={{gap: 8}}>
    <Text>{photos.length} {photos.length === 1 ? 'image' : 'images'} · Tap to view{photos.length > 1 ? ' · Swipe for more' : ''}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{gap: 8}}>
      {photos.map((url, index) => <Pressable key={url} accessibilityRole="button" accessibilityLabel={`View ${title} image ${index + 1} of ${photos.length}`} onPress={() => setSelected(url)}>
        <ResilientImage uri={url} fallbackUri="" accessibilityLabel={`${title}, image ${index + 1}`} resizeMode="cover" style={{width: 144, height: 112, borderRadius: 12}}/>
      </Pressable>)}
    </ScrollView>
    {selected && <Modal onRequestClose={() => setSelected(null)} animationType="fade">
      <View style={{flex: 1, backgroundColor: c.background, paddingTop: insets.top, paddingBottom: insets.bottom}}>
        <Pressable accessibilityRole="button" onPress={() => setSelected(null)} style={{padding: 16, minHeight: 48}}><Text>Close image</Text></Pressable>
        <Text style={{paddingHorizontal: 16}}>{title}</Text>
        <ResilientImage key={selected} uri={selected} fallbackUri="" accessibilityLabel={`${title}, full image`} resizeMode="contain" style={{flex: 1, width: '100%'}}/>
      </View>
    </Modal>}
  </View>;
}
