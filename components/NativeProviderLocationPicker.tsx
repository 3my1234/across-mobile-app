import {KeyboardFrame} from './KeyboardFrame';
import {KeyboardScrollView as ScrollView} from './KeyboardScroll';
import React, {useEffect, useRef, useState} from 'react';
import {ActivityIndicator, Keyboard, Modal, Pressable,  StyleSheet, View} from 'react-native';
import {Camera, MapView, PointAnnotation} from '@maplibre/maplibre-react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ThemedText as Text, ThemedTextInput as Input} from './ThemeProvider';
import {useAccountDesign} from './AccountDesign';
import {currentForegroundLocation} from './foregroundLocation';
import {providerAddressSearch} from './providerAddressSearch';

type Pin = {latitude: number; longitude: number};
export function validProviderPin(value: unknown): value is Pin {
  const point = value as Pin | null;
  return !!point && typeof point.latitude === 'number' && typeof point.longitude === 'number' && Number.isFinite(point.latitude) && Number.isFinite(point.longitude) && Math.abs(point.latitude) <= 90 && Math.abs(point.longitude) <= 180;
}

// Native map renderer; no portal/WebView, Google key, or application API token.
export function NativeProviderLocationPicker({initial, onChoose, onClose,title='Choose service / stock location',hint='Tap the map, or hold and drag the pin. Your post changes only after you confirm and save it.'}: {title?:string;hint?:string;initial?: Pin; onChoose: (pin: Pin) => void; onClose: () => void}) {
  const c = useAccountDesign(), insets = useSafeAreaInsets();
  const [pin, setPin] = useState<Pin | null>(() => validProviderPin(initial) ? initial : null);
  const [camera, setCamera] = useState(() => ({centerCoordinate: validProviderPin(initial) ? [initial.longitude, initial.latitude] : [8.6753, 9.082], zoomLevel: validProviderPin(initial) ? 15 : 5}));
  const [query, setQuery] = useState(''), [results, setResults] = useState<Pin[]>([]);
  const [activeAction, setActiveAction] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [mapFailed, setMapFailed] = useState(false), [mapLoaded, setMapLoaded] = useState(false), [mapVersion, setMapVersion] = useState(0);
  const mounted = useRef(true), flight = useRef(false), closed = useRef(false);
  useEffect(() => {mounted.current = true; return () => {mounted.current = false;};}, []);
  useEffect(() => {const timer = setTimeout(() => {if (mounted.current && !mapLoaded) setMapFailed(true);}, 15000); return () => clearTimeout(timer);}, [mapVersion, mapLoaded]);
  const close = () => {closed.current = true; onClose();};
  const move = (point: Pin) => {if (!validProviderPin(point) || closed.current) return; setPin(point); setResults([]); setCamera({centerCoordinate: [point.longitude, point.latitude], zoomLevel: 16});};
  const chooseFeature = (feature: GeoJSON.Feature) => {
    if (closed.current || feature.geometry?.type !== 'Point') return;
    Keyboard.dismiss();
    const [longitude, latitude] = feature.geometry.coordinates;
    if (validProviderPin({latitude, longitude})) setPin({latitude, longitude});
  };
  const run = async (action: () => Promise<void>) => {
    if (flight.current || closed.current) return; Keyboard.dismiss(); flight.current = true; setBusy(true); setError('');
    try {await action();} catch (failure) {if (mounted.current && !closed.current) setError(failure instanceof Error ? failure.message : 'Location could not load. Retry or choose a pin on the map.');}
    finally {flight.current = false; if (mounted.current && !closed.current) setBusy(false);}
  };
  const button = (label: string, action: () => void, disabled = false) => <Pressable accessibilityRole="button" disabled={disabled} accessibilityState={{disabled, busy: busy && activeAction === label}} onPress={() => {setActiveAction(label); action();}} style={({pressed}) => [s.button, {backgroundColor: pressed ? c.soft : c.surface, borderColor: c.line, opacity: disabled && !busy ? .5 : 1}]}><View style={{flexDirection: 'row', gap: 8, alignItems: 'center'}}>{busy && activeAction === label && <ActivityIndicator accessibilityLabel={`${label} in progress`}/>}<Text style={{color: c.accent, fontWeight: '700'}}>{label}</Text></View></Pressable>;
  return <Modal animationType="slide" onRequestClose={close}><KeyboardFrame style={{flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom, backgroundColor: c.background}}>
    <ScrollView style={{maxHeight: '40%', flexGrow: 0}} contentContainerStyle={s.controls} keyboardShouldPersistTaps="handled"><Text style={s.title}>{title}</Text><Text>{hint}</Text>
      <Input accessibilityLabel="Find a location on the map" value={query} editable={!busy} onChangeText={value => {setQuery(value); setResults([]);}} placeholder="Address, city or landmark" style={[s.input, {borderColor: c.line}]}/>
      <View style={s.row}>{button('Search address', () => void run(async () => {const found = await providerAddressSearch(query); if (mounted.current && !closed.current) setResults(found);}), busy)}{button('Use GPS', () => void run(async () => {const value = await currentForegroundLocation(); if (mounted.current && !closed.current) move(value.coords);}), busy)}</View>
      {!!error && <Text accessibilityRole="alert" style={{color: c.danger}}>{error}</Text>}
      {!!results.length && <ScrollView style={{maxHeight: 120}} keyboardShouldPersistTaps="handled">{results.map((point, index) => <View key={`${point.latitude}:${point.longitude}`}>{button(`Choose result ${index + 1}: ${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`, () => move(point))}</View>)}</ScrollView>}
    </ScrollView>
    <View style={{flex: 1, minHeight: 100}}>
      <MapView key={mapVersion} style={{flex: 1}} mapStyle="https://tiles.openfreemap.org/styles/liberty" attributionEnabled onPress={chooseFeature} onDidFinishLoadingMap={() => {setMapLoaded(true); setMapFailed(false);}} onDidFailLoadingMap={() => setMapFailed(true)}>
        <Camera centerCoordinate={camera.centerCoordinate} zoomLevel={camera.zoomLevel} animationMode="moveTo"/>
        {pin && <PointAnnotation id="provider-location" coordinate={[pin.longitude, pin.latitude]} draggable onDragEnd={chooseFeature}><View collapsable={false} style={s.pin}/></PointAnnotation>}
      </MapView>
      {!mapLoaded && !mapFailed && <View pointerEvents="none" style={s.loading}><ActivityIndicator/><Text>Loading map…</Text></View>}
    </View>
    <View style={s.controls}>
      {mapFailed && <><Text accessibilityRole="alert" style={{color: c.danger}}>Map tiles could not load. Retry, use GPS, or return to manual coordinates.</Text>{button('Retry map', () => {setMapFailed(false); setMapLoaded(false); setMapVersion(value => value + 1);})}</>}
      <Text>{pin ? `Selected: ${pin.latitude.toFixed(6)}, ${pin.longitude.toFixed(6)}` : 'Choose the actual location before confirming.'}</Text>
      <View style={s.row}><View style={{flex: 1}}>{button('Use this location', () => {if (pin && !closed.current) {closed.current = true; onChoose({...pin});}}, busy || !pin)}</View><View>{button('Cancel', close)}</View></View>
    </View>
  </KeyboardFrame></Modal>;
}
const s = StyleSheet.create({controls: {padding: 14, gap: 8}, row: {flexDirection: 'row', gap: 8}, title: {fontSize: 19, fontWeight: '700'}, input: {padding: 12, borderWidth: 1, borderRadius: 12}, button: {padding: 12, minHeight: 44, borderWidth: 1, borderRadius: 12}, pin: {width: 26, height: 26, backgroundColor: '#087B58', borderRadius: 13, borderWidth: 4, borderColor: '#FFFFFF'}, loading: {position: 'absolute', top: 12, alignSelf: 'center', padding: 10, borderRadius: 12, backgroundColor: '#E3F8EF'}});
