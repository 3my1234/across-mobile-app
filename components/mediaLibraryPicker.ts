import {Alert, Platform} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

let choosing = false;
const cancelled = {canceled: true as const, assets: null};

// The system picker grants access to the selected files. Broad library access
// is unnecessary, including when the user previously denied that permission.
export async function chooseLibraryMedia(options: ImagePicker.ImagePickerOptions): Promise<ImagePicker.ImagePickerResult> {
  if (choosing) return cancelled;
  choosing = true;
  try {
    let selectedOptions = options;
    if (Platform.OS === 'android' && !options.legacy) {
      const photosOnly = Array.isArray(options.mediaTypes) && options.mediaTypes.every(type => type === 'images');
      const videosOnly = Array.isArray(options.mediaTypes) && options.mediaTypes.length > 0 && options.mediaTypes.every(type => type === 'videos');
      const source = await new Promise<'photos' | 'other' | null>(resolve => {
        Alert.alert(photosOnly ? 'Choose photo source' : videosOnly ? 'Choose video source' : 'Choose media source',
          'If the first source shows no items, close it and try Gallery or Files. Only files you select are shared with ATL Xpress.', [
            {text: 'Cancel', style: 'cancel', onPress: () => resolve(null)},
            {text: 'Gallery or Files', onPress: () => resolve('other')},
            {text: photosOnly ? 'Photos' : videosOnly ? 'Videos' : 'Photos / videos', onPress: () => resolve('photos')},
          ], {cancelable: true, onDismiss: () => resolve(null)});
      });
      if (!source) return cancelled;
      // GET_CONTENT can expose gallery providers that the Photo Picker's
      // OPEN_DOCUMENT fallback does not show. This is an explicit user choice;
      // an empty list/cancellation is not an error and must not launch a loop.
      if (source === 'other') selectedOptions = {...options, legacy: true, allowsEditing: false};
    }
    const portableImages = Platform.OS === 'ios' && Array.isArray(selectedOptions.mediaTypes) && selectedOptions.mediaTypes.every(type => type === 'images')
      ? {...selectedOptions, preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible}
      : selectedOptions;
    try {
      const result = await ImagePicker.launchImageLibraryAsync(portableImages);
      if (!result.canceled && !result.assets?.length) throw new Error('No selected photo could be read');
      return result;
    } catch (failure) {
      const code = String((failure as {code?: string})?.code || '');
      const message = failure instanceof Error ? failure.message : '';
      // Some Android builds lack a working Photo Picker/crop activity. The
      // system file chooser also offers gallery/document providers. Never
      // reopen a picker after cancellation or an unrelated processing error.
      if (Platform.OS !== 'android' || selectedOptions.legacy || !/missing_activity|failed_to_pick_media/i.test(code) && !/resolve activity|parse PhotoPicker result/i.test(message)) throw failure;
      const fallback = await ImagePicker.launchImageLibraryAsync({...options, legacy: true, allowsEditing: false});
      if (!fallback.canceled && !fallback.assets?.length) throw new Error('No selected photo could be read');
      return fallback;
    }
  } catch {
    Alert.alert('Could not open media', 'Please try again. If the problem continues, check that Photos, Gallery or Files is enabled on your phone, then reopen ATL Xpress.');
    return cancelled;
  } finally {
    choosing = false;
  }
}

// Verification accepts both photos and PDFs. Never force that entry point into
// DocumentsUI: some Android phones have no items there despite a working gallery.
// Share the native-picker lock with profile, listing, chat and video uploads.
export async function chooseUploadDocument(options: DocumentPicker.DocumentPickerOptions): Promise<DocumentPicker.DocumentPickerResult> {
  if (choosing) return cancelled;
  choosing = true;
  try {
    const source = await new Promise<'gallery' | 'files' | null>(resolve => {
      Alert.alert('Choose document or photo', 'Use Gallery for a saved photo, or Files for a PDF or image. If one source is empty, cancel it and try the other.', [
        {text:'Cancel',style:'cancel',onPress:()=>resolve(null)},
        {text:'Gallery / Photos',onPress:()=>resolve('gallery')},
        {text:'Files',onPress:()=>resolve('files')},
      ], {cancelable:true,onDismiss:()=>resolve(null)});
    });
    if (!source) return cancelled;
    if (source === 'files') {
      const result = await DocumentPicker.getDocumentAsync(options);
      if (!result.canceled && !result.assets?.length) throw Error('No selected document could be read');
      return result;
    }
    const result = await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],quality:1,allowsEditing:false,
      ...(Platform.OS === 'android' ? {legacy:true} : {preferredAssetRepresentationMode:ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible})});
    if (result.canceled) return cancelled;
    if (!result.assets?.length) throw Error('No selected photo could be read');
    return {canceled:false,assets:result.assets.map(asset=>({uri:asset.uri,name:asset.fileName || 'verification.jpg',mimeType:asset.mimeType || '',size:asset.fileSize,lastModified:Date.now()}))};
  } catch {
    Alert.alert('Could not open document or photo', 'Please try the other source. Check that Photos, Gallery or Files is enabled on your phone.');
    return cancelled;
  } finally {choosing=false;}
}
