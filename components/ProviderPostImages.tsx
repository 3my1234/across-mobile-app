import React, {useState} from 'react';
import {Modal, Pressable, ScrollView, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ThemedText as Text} from './ThemeProvider';
import {useAccountDesign} from './AccountDesign';
import {ResilientImage} from './ResilientImage';

export function ProviderPostImages({urls, title}: {urls?: string[]; title: string}) {
  const c = useAccountDesign(), insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<string | null>(null);
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const [retry, setRetry] = useState<Record<string, number>>({});
  const photos = Array.from(new Set((urls || []).filter(url => typeof url === 'string' && url.trim())));
  const retryImage = (url: string) => {setFailed(old => ({...old, [url]: false})); setRetry(old => ({...old, [url]: (old[url] || 0) + 1}));};
  const failure = (url: string) => failed[url] && <Pressable accessibilityRole="button" accessibilityLabel={`Retry ${title} image`} onPress={() => retryImage(url)} style={{padding: 12, minHeight: 44}}><Text>Image unavailable. Tap to retry.</Text></Pressable>;
  if (!photos.length) return <Text>No images uploaded</Text>;
  return <View style={{gap: 8}}>
    <Text>{photos.length} {photos.length === 1 ? 'image' : 'images'} · Tap to view{photos.length > 1 ? ' · Swipe for more' : ''}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{gap: 8}}>
      {photos.map((url, index) => <View key={url} style={{width: 144}}><Pressable accessibilityRole="button" accessibilityLabel={`View ${title} image ${index + 1} of ${photos.length}`} onPress={() => setSelected(url)}>
        <ResilientImage key={retry[url] || 0} uri={url} fallbackUri="" onError={() => setFailed(old => ({...old, [url]: true}))} onLoad={() => setFailed(old => ({...old, [url]: false}))} accessibilityLabel={`${title}, image ${index + 1}`} resizeMode="cover" style={{width: 144, height: 112, borderRadius: 12}}/>
      </Pressable>{failure(url)}</View>)}
    </ScrollView>
    {selected && <Modal onRequestClose={() => setSelected(null)} animationType="fade">
      <View style={{flex: 1, backgroundColor: c.background, paddingTop: insets.top, paddingBottom: insets.bottom}}>
        <Pressable accessibilityRole="button" onPress={() => setSelected(null)} style={{padding: 16, minHeight: 48}}><Text>Close image</Text></Pressable>
        <Text style={{paddingHorizontal: 16}}>{title}</Text>
        {failure(selected)}<ResilientImage key={`${selected}:${retry[selected] || 0}`} uri={selected} fallbackUri="" onError={() => setFailed(old => ({...old, [selected]: true}))} onLoad={() => setFailed(old => ({...old, [selected]: false}))} accessibilityLabel={`${title}, full image`} resizeMode="contain" style={{flex: 1, width: '100%'}}/>
      </View>
    </Modal>}
  </View>;
}
