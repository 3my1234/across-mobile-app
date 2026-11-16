import {prepareListingPhoto} from './prepareListingPhoto';
import {ListingVideoPreview} from './CachedListingVideo';
import {saveListingDraft,readListingDraft,clearListingDraft,type SavedListingDraft} from './providerDraftStorage';
import {prepareProviderVideo} from './prepareProviderVideo';
import {waitForProviderVideo} from './providerVideoProcessing';
import {captureListingMedia,chooseLibraryMedia} from './mediaLibraryPicker';
import {KeyboardScrollView as ScrollView} from './KeyboardScroll';
import {NativeServiceCategory} from './NativeServiceCategory';
import {ProviderPanel} from './ProviderPanel';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {AppState, ActivityIndicator, Alert, Keyboard, Linking, Pressable,  StyleSheet, Switch, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ThemedText as Text, ThemedTextInput as Input} from './ThemeProvider';
import {useAccountDesign} from './AccountDesign';
import {providerRequest, putProviderPhoto} from './nativeProviderApi';
import {editablePostSnapshot, makeProductDraft, makeServiceDraft, PostPolicy, postPayload, ProviderPost, providerVideoPreviewURL, serviceTypes, postDraftErrors, PostDraftValidationError, validatePostDraft} from './providerPublishingPolicy';
import {NativeProviderLocationPicker} from './NativeProviderLocationPicker';
import {providerAddressSearch} from './providerAddressSearch';
import {ProviderAccount, verificationImageError} from './nativeProviderPolicy';
import {currentForegroundLocation} from './foregroundLocation';
import {ResilientImage} from './ResilientImage';
import {ProviderPostGrid} from './ProviderPostGrid';
import {listingStepErrors,listingStepForField} from './providerListingSteps';
import {KeyboardFrame} from './KeyboardFrame';
import {NativeProviderAvailability} from './NativeProviderAvailability';
import {NativeProviderProductOptions} from './NativeProviderProductOptions';
import {NativeProviderDeliveryOffer} from './NativeProviderDeliveryOffer';

export function NativeProviderCatalog({embedded = false, token, kind, provider, onClose, onNavigationGuard,initialItemID=''}: {initialItemID?:string;onNavigationGuard?: (guard: ((action: () => void) => void) | null) => void; embedded?: boolean; token: string; kind: 'listings' | 'products'; provider: ProviderAccount; onClose: () => void}) {
  const c = useAccountDesign(), safeInsets = useSafeAreaInsets(), insets = embedded ? {top: 0, bottom: 0} : safeInsets, endpoint = `/providers/me/${kind}`;
  const [items, setItems] = useState<ProviderPost[]>([]), [cursor, setCursor] = useState(''), [policy, setPolicy] = useState<PostPolicy | null>(null);
  const [loading, setLoading] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [step,setStep]=useState(0),[limitsOpen,setLimitsOpen]=useState(false),[deliveryOpen,setDeliveryOpen]=useState(false);
  const goStep=(next:number)=>{Keyboard?.dismiss?.();if(next!==step)positions.current={};setStep(Math.max(0,Math.min(3,next)));scroll.current?.scrollTo({y:0,animated:false});};
  const [draft, setDraft] = useState<ProviderPost | null>(null), [confirmed, setConfirmed] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({}), [numericText, setNumericText] = useState<Record<string, string>>({});
  const [advanced, setAdvanced] = useState(false), [showTypes, setShowTypes] = useState(false), [manualLocation, setManualLocation] = useState(false), [activeAction, setActiveAction] = useState('');
  const scroll = useRef<ScrollView>(null), positions = useRef<Record<string, number>>({}), pendingField=useRef<string|null>(null);
  const errorAt = (key: string) => fieldErrors[key] ? <Text accessibilityRole="alert" style={{color: c.danger}}>{fieldErrors[key]}</Text> : null;
  const focusError = (errors: Record<string, string>) => {setFieldErrors(errors); const key=Object.keys(errors)[0];pendingField.current=key;goStep(listingStepForField(kind,key));if(['capacity','country_code','currency_code','service_radius_km','delivery_times','inventory_country_code'].includes(key))setAdvanced(true);};
  useEffect(()=>{if(!pendingField.current)return;const timer=setTimeout(()=>{const key=pendingField.current;pendingField.current=null;if(key)scroll.current?.scrollTo({y:Math.max(0,(positions.current[key]??0)-16),animated:false});},100);return()=>clearTimeout(timer);},[step,fieldErrors]);
  const [mapOpen, setMapOpen] = useState(false);
  const [recovery,setRecovery]=useState<SavedListingDraft|null>(null),[videoPreview,setVideoPreview]=useState(''),[videoSize,setVideoSize]=useState<{original:number;prepared:number}|null>(null);
  const currentDraft=useRef<{draft:ProviderPost|null;numericText:Record<string,string>;step?:number}>({draft,numericText,step});currentDraft.current={draft,numericText,step};
  const persistDraft=useCallback(async()=>{const current=currentDraft.current;if(current.draft)await saveListingDraft(provider.id,kind,{...current,draft:current.draft,at:Date.now()});},[provider.id,kind]);
  useEffect(()=>{let alive=true;void readListingDraft(provider.id,kind).then(value=>{if(alive)setRecovery(value);}).catch(()=>{});return()=>{alive=false;};},[provider.id,kind]);
  useEffect(()=>{if(!draft)return;const timer=setTimeout(()=>{void persistDraft().catch(()=>{if(mounted.current)setNotice('Could not save this draft on your phone. Save it to your account before leaving.');});},350);return()=>clearTimeout(timer);},[draft,numericText,step,persistDraft]);
  useEffect(()=>{const listener=AppState.addEventListener('change',state=>{if(state!=='active')void persistDraft().catch(()=>{});});return()=>{listener.remove();void persistDraft().catch(()=>{});};},[persistDraft]);

  const [videoProgress,setVideoProgress]=useState<number|null>(null),videoPreparation=useRef<AbortController|null>(null);
  useEffect(()=>{const listener=AppState.addEventListener('change',state=>{if(state==='background'||state==='inactive')videoPreparation.current?.abort();});return()=>{listener.remove();videoPreparation.current?.abort();};},[]);
  const [videoJobs,setVideoJobs]=useState<{key:string;status:string;url?:string;thumbnail_url?:string}[]>([]);
  const [availability, setAvailability] = useState<{id: string; title: string; media_urls?: string[]} | null>(null);
  const [search, setSearch] = useState(''), [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [addressQuery, setAddressQuery] = useState(''), [addressResults, setAddressResults] = useState<{latitude: number; longitude: number}[]>([]);
  const mounted = useRef(true), epoch = useRef(0), flight = useRef(false), loadFlight = useRef(false);
  const invalidate = useCallback(() => {epoch.current++;}, []);
  useEffect(() => {mounted.current = true; return () => {mounted.current = false; invalidate();};}, [invalidate]);
  const load = useCallback(async (next = '', append = false) => {
    if (loadFlight.current && append) return;
    loadFlight.current = true; const version = ++epoch.current;
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({limit: '25'}); if (next) params.set('cursor', next); if (query.trim()) params.set('search', query.trim());
      if (statusFilter) params.set('status', statusFilter);
      const [data, limits] = await Promise.all([providerRequest(token, `${endpoint}?${params}`), providerRequest(token, '/providers/me/post-policy')]);
      if (mounted.current && epoch.current === version) {setItems(old => append ? [...old, ...data.items.filter((row: ProviderPost) => !old.some(existing => existing.id === row.id))] : data.items || []); setCursor(data.page?.next_cursor || data.next_cursor || ''); setPolicy(limits);}
    } catch (failure) {if (mounted.current && epoch.current === version) setError(failure instanceof Error ? failure.message : 'Could not load posts. Retry.');}
    finally {loadFlight.current = false; if (mounted.current && epoch.current === version) setLoading(false);}
  }, [token, endpoint, query, statusFilter]);
  useEffect(() => {void load(); return invalidate;}, [load, invalidate]);
  const run = async (action: () => Promise<void>, errorField = '') => {
    if (flight.current || !mounted.current) return; flight.current = true; setBusy(true); setError(''); setNotice('');
    try {await action();} catch (failure) {if (mounted.current) if (failure instanceof PostDraftValidationError) focusError({[failure.field]: failure.message}); else if (errorField) focusError({[errorField]: failure instanceof Error ? failure.message : 'Please try again.'}); else {setError(failure instanceof Error ? failure.message : 'Could not complete this operation.'); scroll.current?.scrollTo({y: 0, animated: true});}}
    finally {flight.current = false; if (mounted.current) {setBusy(false); setActiveAction('');}}
  };
  const button = (label: string, action: () => void, disabled = false) => <Pressable accessibilityRole="button" accessibilityState={{disabled: disabled || busy, busy: busy && activeAction === label}} disabled={disabled || busy} onPress={() => {setActiveAction(label); action();}} style={({pressed}) => [s.button, {borderColor: c.line, backgroundColor: pressed ? c.soft : c.surface, opacity: disabled ? .5 : 1}]}><View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>{busy && activeAction === label && <ActivityIndicator accessibilityLabel={`${label} in progress`}/>}<Text style={{color: c.accent, fontWeight: '700'}}>{label}</Text></View></Pressable>;
  const patch = (key: string, value: unknown) => {
    if(pendingField.current===key)pendingField.current=null;
    setFieldErrors(old => {const next = {...old}; delete next[key]; if (['media_urls', 'image_urls'].includes(key)) delete next.images; if (key === 'video_urls' || key === 'attributes') delete next.videos; if (['latitude', 'longitude', 'inventory_latitude', 'inventory_longitude'].includes(key)) delete next.location; return next;});
    const coordinate = ['latitude', 'longitude', 'inventory_latitude', 'inventory_longitude'].includes(key);
    if (coordinate) setConfirmed(false);
    setDraft(old => old ? {...old, [key]: value, ...(coordinate && kind === 'listings' ? {attributes: {...old.attributes, location_source: 'manual', location_accuracy_m: null, location_captured_at: new Date().toISOString()}} : {})} : old);
  };
  const field = (key: string, label: string, numeric = false, multiline = false) => <View key={key} onLayout={event => {positions.current[key] = event.nativeEvent.layout.y;}} style={{gap: 6}}><Text>{label}</Text><Input accessibilityLabel={label} editable={!busy} value={numericText[key] ?? (draft?.[key] == null ? '' : String(draft[key]))} multiline={multiline} keyboardType={numeric ? 'decimal-pad' : 'default'} onChangeText={text => {if (numeric) setNumericText(old => ({...old, [key]: text})); patch(key, numeric ? text === '' ? null : Number(text) : text);}} style={[s.input, {borderColor: fieldErrors[key] ? c.danger : c.line}, multiline && {minHeight: 85, textAlignVertical: 'top'}]}/>{errorAt(key)}</View>;
  const create = () => {goStep(0);setDeliveryOpen(false);setDraft(kind === 'listings' ? makeServiceDraft(provider) : makeProductDraft(provider)); setAddressQuery(''); setAddressResults([]); setConfirmed(false); setNotice(''); setError(''); setFieldErrors({}); setNumericText({}); setAdvanced(false);};
  const edit = (item: ProviderPost) => void run(async () => {
    // The private detail read supplies contacts missing from list snapshots.
    // An older server's 404 leaves the editor closed rather than clearing fields.
    const snapshot = kind === 'listings' ? await providerRequest(token, `${endpoint}/${item.id}`) : item;
    const editable = editablePostSnapshot(kind, snapshot, item.id);
    if (mounted.current) {goStep(0);setDraft(editable); setAddressQuery(''); setAddressResults([]); setConfirmed(false); setError(''); setNotice(''); setFieldErrors({}); setNumericText({});}
  });
  const initialEdit=useRef(false);
  useEffect(()=>{if(!initialItemID||initialEdit.current||loading||!policy)return;initialEdit.current=true;void run(async()=>{const snapshot=kind==='listings'?await providerRequest(token,`${endpoint}/${initialItemID}`):(await providerRequest(token,`${endpoint}?product_id=${encodeURIComponent(initialItemID)}&limit=1`)).items?.find((item:ProviderPost)=>item.id===initialItemID);if(!snapshot)throw Error('This listing is unavailable.');const editable=editablePostSnapshot(kind,snapshot,initialItemID);if(mounted.current){goStep(0);setDraft(editable);setConfirmed(false);}});},[initialItemID,loading,policy]);
  const images = draft ? kind === 'listings' ? draft.media_urls || [] : draft.image_urls || [] : [];
  const videos = draft ? kind === 'listings' ? draft.attributes?.video_urls || [] : draft.video_urls || [] : [];
  const setImages = (urls: string[]) => patch(kind === 'listings' ? 'media_urls' : 'image_urls', urls);
  const setVideos = (urls: string[]) => kind === 'listings' ? patch('attributes', {...draft?.attributes, video_urls: urls}) : patch('video_urls', urls);
  const addMedia = (video = false, camera = false) => void run(async () => {
    const limits: PostPolicy = await providerRequest(token, '/providers/me/post-policy');
    if (video && limits.video_uploads_paused) throw new Error('New video uploads are temporarily paused. Your published videos remain available.');
    if (video ? videos.length >= limits.max_videos : images.length >= limits.max_images) throw new Error(video ? 'Your plan does not allow more videos. Remove a video or upgrade.' : 'Your image limit is reached. Remove an image or upgrade.');
    await persistDraft();
    const result = camera ? await captureListingMedia(video,limits.max_video_seconds) : await chooseLibraryMedia({mediaTypes: video ? ['videos'] : ['images'], quality: 1, allowsEditing: false}); if (result.canceled) return;
    const asset = result.assets[0];
    let upload={uri:asset.uri,mimeType:asset.mimeType||'',fileName:asset.fileName||'post.jpg',fileSize:asset.fileSize},cleanup=()=>{};
    try {
     if(video){
      const controller=new AbortController();videoPreparation.current=controller;
      setVideoProgress(0);
      const compressed=await prepareProviderVideo(asset,limits,controller.signal,percent=>{if(mounted.current)setVideoProgress(percent);});
      upload=compressed;cleanup=compressed.cleanup;if(mounted.current)setVideoSize({original:compressed.originalSize,prepared:compressed.fileSize});
     }else{const photo=await prepareListingPhoto(asset);upload=photo;cleanup=photo.cleanup;const validation=verificationImageError(upload.mimeType,upload.fileSize||0);if(validation)throw Error(validation);}
     if(!mounted.current||AppState.currentState==='background'||AppState.currentState==='inactive'||videoPreparation.current?.signal.aborted)throw Error('Upload paused. Reopen the app and select your video again.');
     if(video)setVideoProgress(null);
     const signed=await providerRequest(token,'/providers/me/uploads/presign',{method:'POST',body:JSON.stringify({filename:upload.fileName,mime_type:upload.mimeType,purpose:video?'post_video':'listing',post_id:draft?.id||undefined,post_kind:kind,file_size:upload.fileSize})});
     const processedImage=await putProviderPhoto(signed.upload_url,upload.uri,upload.mimeType,video?50*1024*1024:10*1024*1024,{token,key:signed.key,processing_required:signed.processing_required,active:()=>mounted.current&&AppState.currentState!=='background'&&AppState.currentState!=='inactive'});
     if(video){const accepted=await providerRequest(token,'/providers/me/videos/complete',{method:'POST',body:JSON.stringify({key:signed.key})});const verified=await waitForProviderVideo(accepted,signed.key,path=>providerRequest(token,path),()=>mounted.current&&AppState.currentState!=='background'&&AppState.currentState!=='inactive');if(mounted.current)setVideos([...videos,verified.url]);}
     else if(mounted.current)setImages([...images,processedImage?.url||signed.view_url]);
    }finally{cleanup();videoPreparation.current=null;if(mounted.current)setVideoProgress(null);}
    if (mounted.current) setPolicy(limits);
  }, video ? 'videos' : 'images');
  const locate = () => void run(async () => {setNumericText(old => {const next = {...old}; for (const key of ['latitude', 'longitude', 'inventory_latitude', 'inventory_longitude']) delete next[key]; return next;}); const location = await currentForegroundLocation(); if (!mounted.current) return; const {latitude, longitude, accuracy} = location.coords; setConfirmed(false); setDraft(old => old ? kind === 'listings' ? {...old, latitude, longitude, attributes: {...old.attributes, location_source: 'device', location_accuracy_m: accuracy, location_captured_at: new Date().toISOString()}} : {...old, inventory_latitude: latitude, inventory_longitude: longitude} : old);}, 'location');
  const findAddress = () => void run(async () => {
    setAddressResults([]);
    const composed = kind === 'listings' ? [draft?.address_line, draft?.city, draft?.state, draft?.country_code] : [draft?.inventory_location, draft?.inventory_city, draft?.inventory_country_code];
    const results = await providerAddressSearch(addressQuery.trim() || composed.filter(Boolean).join(', '));
    if (mounted.current) setAddressResults(results);
  }, 'location');
  const chooseAddress = ({latitude, longitude}: {latitude: number; longitude: number}) => {
    setNumericText(old => {const next = {...old}; for (const key of ['latitude', 'longitude', 'inventory_latitude', 'inventory_longitude']) delete next[key]; return next;});
    setConfirmed(false); setAddressResults([]);
    setDraft(old => old ? kind === 'listings' ? {...old, latitude, longitude, attributes: {...old.attributes, location_source: 'address_search', location_accuracy_m: null, location_captured_at: new Date().toISOString()}} : {...old, inventory_latitude: latitude, inventory_longitude: longitude} : old);
  };
  const latitude = kind === 'listings' ? draft?.latitude : draft?.inventory_latitude, longitude = kind === 'listings' ? draft?.longitude : draft?.inventory_longitude;
  const save = (submit=false) => {
    if (!draft || !policy || flight.current) return;
    const errors = postDraftErrors(kind, draft, policy, confirmed);
    if (Object.keys(errors).length) {focusError(errors); return;}
    void run(async () => {
      const latest = await providerRequest(token, '/providers/me/post-policy'); validatePostDraft(kind, draft, latest, confirmed);
      const saved=await providerRequest(token, draft.id ? `${endpoint}/${draft.id}` : endpoint, {method: draft.id ? 'PATCH' : 'POST', body: JSON.stringify(postPayload(kind, draft))});
      if(submit){
        const id=draft.id||saved?.id;
        if(!id)throw Error('The server saved this post but did not return its reference. Refresh your posts before retrying.');
        const savedDraft={...draft,id};currentDraft.current={draft:savedDraft,numericText,step:3};if(mounted.current)setDraft(savedDraft);
        // Retain the confirmed ID before submission: a failed submit cannot create a duplicate post.
        await persistDraft().catch(()=>{});
        const previous=kind==='products'?draft.moderation_status:draft.status;
        if(!['approved','pending'].includes(previous))await providerRequest(token,`${endpoint}/${id}/submit`,{method:'POST'});
      }
      currentDraft.current={draft:null,numericText:{}};setRecovery(null);if(mounted.current)setDraft(null);
      let localWarning='';try{await clearListingDraft(provider.id,kind);}catch{localWarning=' The saved phone copy could not be cleared. Do not republish it; open the saved post instead.';}
      if (mounted.current) {setFieldErrors({}); setNotice((submit?'Submitted for review. Customers can see it after approval.':'Saved. Submit your draft for review when ready. Customers can message you after approval.')+localWarning); await load();}
    });
  };
  const transition = (item: ProviderPost, archive: boolean) => Alert.alert(archive ? 'Archive this post?' : 'Submit for review?', archive ? 'This removes it from your active catalogue. Existing conversations are preserved.' : 'Atlantic Express will review this post before publication.', [{text: 'Cancel', style: 'cancel'}, {text: archive ? 'Archive' : 'Submit', style: archive ? 'destructive' : 'default', onPress: () => void run(async () => {await providerRequest(token, `${endpoint}/${item.id}${archive ? '' : '/submit'}`, {method: archive ? 'DELETE' : 'POST'}); if (mounted.current) {setNotice(archive ? 'Post archived.' : 'Post submitted for review.'); await load();}})}]);
  const exitEditor = () => {if(flight.current)return;if(draft&&step>0){goStep(step-1);return;}if (!draft) onClose(); else Alert.alert('Leave this draft?', 'Unsaved changes will be discarded.', [{text: 'Keep editing', style: 'cancel'}, {text: 'Discard changes', style: 'destructive', onPress: () => {currentDraft.current={draft:null,numericText:{}};void clearListingDraft(provider.id,kind).catch(()=>{});setRecovery(null);setDraft(null);}}]);};
  useEffect(() => {
    if (!onNavigationGuard) return;
    onNavigationGuard(action => {
      if (flight.current) return;
      if (!draft) {action(); return;}
      Alert.alert('Leave this draft?', 'Your unsaved changes will be discarded.', [{text: 'Keep editing', style: 'cancel'}, {text: 'Discard changes', style: 'destructive', onPress: () => {currentDraft.current={draft:null,numericText:{}};void clearListingDraft(provider.id,kind).catch(()=>{});setRecovery(null);setDraft(null); action();}}]);
    });
    return () => onNavigationGuard(null);
  }, [onNavigationGuard, draft]);
  if (availability) return <NativeProviderAvailability embedded={embedded} token={token} service={availability} onClose={() => setAvailability(null)}/>;
  const noun=kind==='products'?'product':'service';
  const next=()=>{if(!draft||!policy)return;const errors=listingStepErrors(kind,draft,policy,confirmed,step);if(Object.keys(errors).length){focusError(errors);return;}goStep(step+1);};
  const saveProgress=()=>{if(step===3){save();return;}void run(async()=>{if(!draft)return;const saved={draft,numericText,step,at:Date.now()};await saveListingDraft(provider.id,kind,saved);currentDraft.current={draft:null,numericText:{}};setDraft(null);setRecovery(saved);setNotice('Draft saved on this phone. Resume it here when you are ready.');});};
  const primary=(label:string,action:()=>void)=><Pressable accessibilityRole="button" disabled={busy||!policy} onPress={action} style={{minHeight:52,borderRadius:14,padding:15,backgroundColor:c.accent,opacity:busy||!policy?0.5:1}}><Text style={{fontSize:17,fontWeight:'800',textAlign:'center',color:c.dark?'#08251B':'#FFF'}}>{label}</Text></Pressable>;
  return <ProviderPanel embedded={embedded} onClose={exitEditor}><KeyboardFrame bottomInset={insets.bottom} style={{flex:1,paddingTop:insets.top,backgroundColor:c.background}}>
    <View style={[s.header,{backgroundColor:c.surface}]}><Pressable accessibilityRole="button" accessibilityLabel={draft&&step>0?'Previous step':draft?'Cancel editing':'Back'} disabled={busy} onPress={exitEditor} style={{minHeight:44,minWidth:44,alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:32,color:c.accent}}>{'\u2039'}</Text></Pressable><Text accessibilityRole="header" style={[s.title,{flex:1}]}>{draft?`${draft.id?'Edit':'Add'} a ${noun}`:kind==='products'?'Products':'Services'}</Text>{draft?button('Save draft',saveProgress,!policy):button('+ Create post',create,!policy||loading||provider.is_active===false)}</View>
    <ScrollView ref={scroll} contentContainerStyle={{padding:16,gap:14,paddingBottom:24}} keyboardShouldPersistTaps="handled">
      {errorAt('form')}{!!error&&<Text accessibilityRole="alert" style={{color:c.danger}}>{error} After an interrupted submission, refresh before retrying.</Text>}{!!notice&&<Text accessibilityLiveRegion="polite">{notice}</Text>}{(busy||loading)&&<ActivityIndicator/>}
      {!draft&&policy&&<View><View style={{flexDirection:'row',alignItems:'center',gap:8}}><Text style={{flex:1,fontSize:13}}>Plan limit: {policy.post_limit} products and services combined</Text><Pressable accessibilityRole="button" onPress={()=>setLimitsOpen(!limitsOpen)} style={{minHeight:44,justifyContent:'center'}}><Text style={{color:c.accent,textDecorationLine:'underline'}}>View limits</Text></Pressable></View>{limitsOpen&&<Text>Per listing: {policy.max_images} photos and {policy.max_videos} videos. Videos up to {policy.max_video_seconds} seconds. Unarchived product and service drafts also use a listing place.</Text>}</View>}
      {!draft?<>
        {recovery&&<View style={[s.card,{borderColor:c.accent}]}><Text>An unfinished listing was saved on this phone, including uploaded photos.</Text>{button('Resume saved listing',()=>{setDraft(recovery.draft);setNumericText(recovery.numericText);setConfirmed(false);goStep(recovery.step||0);setRecovery(null);})}{button('Discard saved listing',()=>void run(async()=>{await clearListingDraft(provider.id,kind);setRecovery(null);}))}</View>}
        <View style={{flexDirection:'row',gap:8,alignItems:'center'}}><Input accessibilityLabel="Search posts" value={search} onChangeText={setSearch} onSubmitEditing={()=>{if(query===search)void load();else setQuery(search);}} placeholder="Search your posts" returnKeyType="search" style={[s.input,{borderColor:c.line,flex:1}]}/>{button('Search',()=>{if(query===search)void load();else setQuery(search);},loading)}</View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8}}>{['','draft','pending','approved','rejected','suspended','archived'].map(status=><Pressable key={status} accessibilityRole="radio" accessibilityState={{checked:statusFilter===status,disabled:busy||loading}} disabled={busy||loading} onPress={()=>setStatusFilter(status)} style={[s.button,{paddingHorizontal:16,borderColor:c.line,backgroundColor:statusFilter===status?c.accent:c.surface}]}><Text style={{textTransform:'capitalize',color:statusFilter===status?(c.dark?'#08251B':'#FFF'):c.text}}>{status||'All statuses'}</Text></Pressable>)}</ScrollView>
        {!loading&&!items.length&&<Text>No matching posts. Create your first {noun}.</Text>}
        <ProviderPostGrid items={items} kind={kind} busy={busy||loading} onEdit={edit} onArchive={item=>transition(item,true)} onSubmit={item=>transition(item,false)} onAvailability={item=>setAvailability({id:item.id,title:item.title,media_urls:item.media_urls})}/>
        {!!cursor&&button('Load more',()=>void load(cursor,true),loading)}{button('Refresh',()=>void load(),loading)}
      </>:<>
        <View style={{flexDirection:'row',alignItems:'center',gap:12}}><Text accessibilityLiveRegion="polite" style={{fontWeight:'700'}}>Step {step+1} of 4</Text><View style={{flex:1,flexDirection:'row',alignItems:'center'}}>{[0,1,2,3].map(index=><View key={index} style={{flex:1,flexDirection:'row',alignItems:'center'}}><View style={{width:22,height:22,borderRadius:11,borderWidth:2,borderColor:index<=step?c.accent:c.muted,backgroundColor:index<=step?c.accent:c.surface,alignItems:'center',justifyContent:'center'}}>{index<step&&<Text style={{color:c.dark?'#08251B':'#FFF',fontSize:12}}>{'\u2713'}</Text>}</View>{index<3&&<View style={{flex:1,height:2,backgroundColor:index<step?c.accent:c.line}}/>}</View>)}</View></View>
        <Text accessibilityRole="header" style={{fontSize:25,fontWeight:'800'}}>{[kind==='products'?'What are you selling?':'What service do you offer?',kind==='products'?'Location & delivery':'Location & service area','Photos & video',`Review your ${noun}`][step]}</Text>
        {step===0&&<>
          {field('title',kind==='products'?'Product name':'Name of your service')}
          {kind==='products'?<NativeProviderProductOptions section="details" draft={draft} patch={patch} busy={busy} errors={fieldErrors}/>:null}
          {field('description','What will the customer get?',false,true)}
          {kind==='products'?<><View style={{flexDirection:'row',gap:12}}><View style={{flex:2}}>{field('local_selling_price',`Selling price (${draft.currency_code})`,true)}</View><View style={{flex:1}}>{field('inventory_count','How many are available?',true)}</View></View></>:<>
        <NativeServiceCategory value={draft.category || ''} disabled={busy} error={fieldErrors.category} onChange={value => patch('category', value)} onChoose={(value, type) => {patch('category', value); patch('listing_type', type);}}/>
        {button(`Service type: ${({'artisan': 'Professional service', 'fuel_station': 'Fuel / gas station', 'property': 'Property enquiry', 'land': 'Land enquiry'} as Record<string, string>)[draft.listing_type] || draft.listing_type.replace(/_/g, ' ')}`, () => setShowTypes(!showTypes))}
        {showTypes && <View style={{gap: 6}}>{serviceTypes.map(type => <Pressable accessibilityRole="radio" accessibilityState={{checked: draft.listing_type === type, disabled: busy}} disabled={busy} key={type} onPress={() => {patch('listing_type', type); setShowTypes(false);}} style={[s.button, {backgroundColor: draft.listing_type === type ? c.soft : c.surface, borderColor: c.line}]}><Text>{type === 'artisan' ? 'Professional service (any other service)' : type.replace(/_/g, ' ')}</Text></Pressable>)}</View>}{errorAt('listing_type')}
        <Text style={s.title}>How do you set your price?</Text>
        {([['fixed', 'One set price', 'The customer pays this amount for the service described.'], ['from', 'Price starts from', 'Give your lowest price. Explain what may cost more.'], ['quote', 'Agree a price in chat', 'The customer messages you. Check what they need, then agree a price.']] as const).map(([mode, label, help]) => <Pressable key={mode} accessibilityRole="radio" accessibilityState={{checked: draft.attributes?.price_mode === mode, disabled: busy}} disabled={busy} onPress={() => patch('attributes', {...draft.attributes, price_mode: mode})} style={[s.card, {borderColor: draft.attributes?.price_mode === mode ? c.accent : c.line, backgroundColor: draft.attributes?.price_mode === mode ? c.soft : c.surface}]}><Text style={{fontWeight: '700'}}>{draft.attributes?.price_mode === mode ? 'Selected: ' : ''}{label}</Text><Text>{help}</Text></Pressable>)}
        {draft.attributes?.price_mode !== 'quote' && field('price', draft.attributes?.price_mode === 'from' ? `Starting price (${draft.currency_code})` : `Your price (${draft.currency_code})`, true)}{errorAt('price_mode')}
        {draft.attributes?.price_mode !== 'quote' && <><Input value={draft.attributes?.price_notes || ''} editable={!busy} onChangeText={value => patch('attributes', {...draft.attributes, price_notes: value})} placeholder="For example: replacement parts cost extra" accessibilityLabel="What can change the price? (optional)" style={[s.input, {borderColor: c.line}]}/>{field('pricing_unit', 'This price covers (for example: one visit or one hour)')}</>}

          </>}
          <Text style={{fontSize:12,color:c.muted}}>Save draft keeps unfinished work on this phone. You can finish it later.</Text>
        </>}
        {step===1&&<>
          {kind==='listings'?<>
{field('city', 'City')}{field('state', 'State / region')}{field('address_line', 'Address or area')}
        {button(advanced ? 'Hide extra service details' : 'Extra service details (optional)', () => setAdvanced(!advanced))}
        {advanced && <>{field('country_code', 'Country code (NG for Nigeria)')}{field('currency_code', 'Currency code (NGN for naira)')}{field('capacity', 'How many customers can you serve at the same time?', true)}{field('contact_email', 'Business email')}{field('contact_phone', 'Business phone')}{field('service_radius_km', 'How far away can customers find you? (km)', true)}</>}{[['is_mobile_service', 'I can travel to the customer'], ['is_available_now', 'Customers can contact me now']].map(([key, label]) => <View key={key} style={s.header}><Text style={{flex: 1}}>{label}</Text><Switch disabled={busy} value={Boolean(draft[key])} onValueChange={value => patch(key, value)}/></View>)}

          </>:<>
            <NativeProviderProductOptions section="location" draft={draft} patch={patch} busy={busy} errors={fieldErrors}/>
            {field('inventory_city','Stock city')}{field('inventory_location','Stock address or area')}
            <Text style={s.title}>Delivery areas</Text><Text>Add where you can deliver or arrange pickup. The customer agrees delivery and payment with you in chat.</Text>{errorAt('delivery_areas')}
            {(draft.delivery_areas||[]).map((area:ProviderPost,index:number)=><View key={index} style={[s.card,{borderColor:c.line}]}><Text>{[area.city,area.state,area.country_code].filter(Boolean).join(', ')} | {area.currency_code} {area.delivery_fee??0} delivery</Text>{button('Remove delivery area',()=>patch('delivery_areas',draft.delivery_areas.filter((_:unknown,i:number)=>i!==index)))}</View>)}
            {button(deliveryOpen?'Cancel delivery area':'+ Add delivery area',()=>setDeliveryOpen(!deliveryOpen))}{deliveryOpen&&<NativeProviderDeliveryOffer draft={draft} patch={(key,value)=>{patch(key,value);if(key==='delivery_areas')setDeliveryOpen(false);}} busy={busy}/>}
        {button(advanced ? 'Hide extra product details' : 'Extra product details (optional)', () => setAdvanced(!advanced))}
        {advanced && <>{!draft.id && field('sku', 'Stock code (optional)')}{field('currency_code', 'Currency code (NGN for naira)')}{field('handling_time_hours', 'Hours needed to prepare the product', true)}{field('delivery_min_days', 'Earliest delivery (days)', true)}{field('delivery_max_days', 'Latest delivery (days)', true)}{errorAt('delivery_times')}{field('return_policy', 'Returns information (optional)', false, true)}</>}

            {advanced&&field('inventory_country_code','Stock country code (NG for Nigeria)')}
          </>}
      {(kind === 'listings' || draft.fulfillment_mode === 'merchant_local') && <View onLayout={event => {positions.current.location = event.nativeEvent.layout.y;}} style={[s.card, {borderColor: fieldErrors.location ? c.danger : c.line}]}><Text style={{fontWeight: '700'}}>Pin the actual {kind === 'listings' ? 'service' : 'stock'} location</Text><Text>Use your phone location when you are there, or choose the correct place on the map.</Text>{button('Choose on map', () => setMapOpen(true))}{button('Use my current location', locate)}
        <Input accessibilityLabel="Search service or stock address" editable={!busy} value={addressQuery} onChangeText={value => {setAddressQuery(value); setAddressResults([]);}} placeholder="Address, city or landmark" style={[s.input, {borderColor: c.line}]}/>{button('Search address', findAddress)}{addressResults.map((point, index) => <View key={`${point.latitude}:${point.longitude}`}>{button(`Use location ${index + 1}: ${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}`, () => chooseAddress(point))}</View>)}
        {button(manualLocation ? 'Hide coordinates' : 'Enter coordinates manually (optional)', () => setManualLocation(!manualLocation))}{manualLocation && <>{field(kind === 'listings' ? 'latitude' : 'inventory_latitude', 'Latitude', true)}{field(kind === 'listings' ? 'longitude' : 'inventory_longitude', 'Longitude', true)}</>}
        {Number.isFinite(latitude) && Number.isFinite(longitude) && <><Text>Selected pin: {latitude.toFixed(6)}, {longitude.toFixed(6)}</Text>{button('Check this pin in Maps', () => void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`).catch(() => setError('Could not open Maps. Retry.')))}</>}
        <View style={s.header}><Text style={{flex: 1}}>Yes, this pin is at my actual service / stock location</Text><Switch accessibilityLabel="Confirm actual listing location" disabled={busy} value={confirmed} onValueChange={value => {setConfirmed(value); setFieldErrors(old => {const next = {...old}; delete next.location; return next;});}}/></View>{errorAt('location')}
      </View>}

        </>}
        {step===2&&<>
          <Text>Show the actual item or the service you offer. The first photo is the cover.</Text>
      <View onLayout={event => {positions.current.images = event.nativeEvent.layout.y;}}><Text style={s.title}>Photos & video</Text>{errorAt('images')}</View><View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8}}>{images.map((url: string, index: number) => <View key={`${url}-${index}`} style={index===0?{width:'100%'}:undefined}><ResilientImage uri={url} fallbackUri="" resizeMode="cover" style={index===0?{width:'100%',aspectRatio:1,maxHeight:320,borderRadius:14}:{width:110,height:90,borderRadius:10}}/>{index===0&&<Text style={{fontSize:12,color:c.accent}}>Cover photo</Text>}{index>0&&button('Make cover',()=>setImages([url,...images.filter((_:string,i:number)=>i!==index)]))}{button('Remove', () => setImages(images.filter((_: string, i: number) => i !== index)))}</View>)}</View><View style={{flexDirection:'row',gap:8}}><View style={{flex:1}}>{button('Choose photos',()=>addMedia())}</View><View style={{flex:1}}>{button('Take photo',()=>addMedia(false,true))}</View></View><Text>Photos are optimized for upload. Your original photo is kept.</Text><Text style={s.title}>Videos (optional)</Text><Text>Record a video or choose one from your phone. Keep ATL Xpress open while it is prepared and uploaded. Your original recording is kept.</Text>{videoProgress!==null&&<View><Text accessibilityLiveRegion="polite">Preparing video on this phone: {videoProgress}%</Text><Pressable accessibilityRole="button" onPress={()=>videoPreparation.current?.abort()} style={{padding:12,minHeight:44}}><Text style={{color:c.danger}}>Cancel preparation</Text></Pressable></View>}{videoSize&&<Text>Original: {(videoSize.original/1024/1024).toFixed(2)} MiB; prepared: {(videoSize.prepared/1024/1024).toFixed(2)} MiB ({Math.max(0,Math.round((1-videoSize.prepared/videoSize.original)*100))}% smaller)</Text>}{errorAt('videos')}{videos.map((url: string, index: number) => <View key={index}><Text>Video {index + 1}</Text>{button('Preview video', () => setVideoPreview(providerVideoPreviewURL(url)))}{button('Remove video', () => setVideos(videos.filter((_: string, i: number) => i !== index)))}</View>)}<View style={{flexDirection:'row',gap:8}}><View style={{flex:1}}>{button('Choose video',()=>addMedia(true),!policy||policy.max_videos===0||policy.video_uploads_paused===true)}</View><View style={{flex:1}}>{button('Record video',()=>addMedia(true,true),!policy||policy.max_videos===0||policy.video_uploads_paused===true)}</View></View>{button('Check uploaded videos',()=>void run(async()=>{const response=await providerRequest(token,'/providers/me/videos');if(mounted.current)setVideoJobs(response.items||[]);}))}{videoJobs.map(job=><View key={job.key}>{job.thumbnail_url&&<ResilientImage uri={job.thumbnail_url} fallbackUri="" style={{width:96,height:72,borderRadius:8}}/>}<Text>{job.status==='complete'?'Video ready':job.status==='failed'?'Video could not be prepared':'Preparing video'}</Text>{job.status==='complete'&&job.url&&button('Use video',()=>{if(job.url)setVideos([...videos,job.url]);},!policy||videos.length>=policy.max_videos||videos.includes(job.url)||policy.video_uploads_paused===true)}</View>)}
          {policy&&<Text style={{fontSize:12,color:c.muted}}>Up to {policy.max_images} photos{policy.max_videos?` and ${policy.max_videos} video, up to ${Math.floor(policy.max_video_seconds/60)} minutes`:'; video uploads require an eligible plan'}.</Text>}
        </>}
        {step===3&&<>
          <View style={[s.card,{borderColor:c.line,flexDirection:'row',alignItems:'center'}]}><ResilientImage uri={images[0]||''} fallbackUri="" style={{width:100,height:100,borderRadius:12}}/><View style={{flex:1,gap:8}}><Text style={{fontSize:20,fontWeight:'800'}}>{draft.title}</Text><Text style={{fontWeight:'700'}}>{kind==='listings'&&draft.attributes?.price_mode==='quote'?'Ask for a quote':`${draft.currency_code} ${Number(kind==='products'?draft.local_selling_price:draft.price).toLocaleString('en-NG')}`}</Text><Text>{kind==='products'?draft.inventory_city:draft.city}</Text></View></View>
          {[{title:kind==='products'?'Product details':'Service details',value:draft.description,step:0},{title:'Location',value:kind==='products'?draft.inventory_location:[draft.address_line,draft.city,draft.state].filter(Boolean).join(', '),step:1},{title:kind==='products'?'Delivery & stock':'Service area',value:kind==='products'?`${draft.inventory_count} in stock | ${(draft.delivery_methods||[]).join(' / ')} | ${(draft.delivery_areas||[]).length} delivery areas`:`${draft.service_radius_km||25} km | ${draft.is_mobile_service?'I travel to customers':'At my location'}`,step:1},{title:'Photos & video',value:`${images.length} photos | ${videos.length} videos`,step:2}].map(row=><Pressable key={row.title} accessibilityRole="button" accessibilityLabel={`Edit ${row.title.toLowerCase()}`} disabled={busy} onPress={()=>goStep(row.step)} style={[s.card,{borderColor:c.line,flexDirection:'row',alignItems:'center'}]}><View style={{flex:1,gap:4}}><Text style={{fontWeight:'700'}}>{row.title}</Text><Text numberOfLines={3} style={{fontSize:13,color:c.muted}}>{row.value}</Text></View><Text style={{color:c.accent}}>Edit {'\u203A'}</Text></Pressable>)}
          {kind==='listings'&&!draft.is_available_now&&<Text style={{color:c.muted}}>This service is set to offline. Customers can find it when you make it available after approval.</Text>}{['approved','pending'].includes(kind==='products'?draft.moderation_status:draft.status)&&<Text style={{color:c.muted}}>Saving changes to this listing sends it back for review.</Text>}<Text>Customers can see your {noun} after approval. They message you to agree payment, delivery or the work needed.</Text><Text style={{fontSize:12,color:c.muted}}>Save draft saves this completed listing to your account without submitting it.</Text>
        </>}
      </>}
    </ScrollView>
    {draft&&<View style={{padding:12,borderTopWidth:1,borderColor:c.line,backgroundColor:c.surface}}>{primary(step===3?'Submit for review':step===2?`Preview ${noun}`:step===0?(kind==='products'?'Next: Location & delivery':'Next: Location & service area'):'Next: Photos & video',step===3?()=>save(true):next)}</View>}
    {!!videoPreview&&<ListingVideoPreview uri={videoPreview} onClose={()=>setVideoPreview('')}/>}{mapOpen&&draft&&<NativeProviderLocationPicker initial={latitude==null||longitude==null?undefined:{latitude,longitude}} onClose={()=>setMapOpen(false)} onChoose={point=>{chooseAddress(point);if(kind==='listings')setDraft(old=>old?{...old,attributes:{...old.attributes,location_source:'map'}}:old);setMapOpen(false);}}/>}
  </KeyboardFrame></ProviderPanel>;

}
const s = StyleSheet.create({header: {flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10}, title: {fontSize: 18, fontWeight: '700'}, card: {borderWidth: 1, borderRadius: 16, padding: 14, gap: 10}, button: {borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 44, justifyContent: 'center'}, input: {borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 46}});
