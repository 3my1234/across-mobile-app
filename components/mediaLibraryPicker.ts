import {Alert, Platform} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

let choosing = false;
const cancelled: ImagePicker.ImagePickerResult = {canceled: true, assets: null};

// The system picker grants access to the selected files. Broad library access
// is unnecessary, including when the user previously denied that permission.
export async function chooseLibraryMedia(options: ImagePicker.ImagePickerOptions): Promise<ImagePicker.ImagePickerResult> {
  if (choosing) return cancelled;
  choosing = true;
  const portableImages = Platform.OS === 'ios' && Array.isArray(options.mediaTypes) && options.mediaTypes.every(type => type === 'images')
    ? {...options, preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible}
    : options;
  try {
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
      if (Platform.OS !== 'android' || !/missing_activity|failed_to_pick_media/i.test(code) && !/resolve activity|parse PhotoPicker result/i.test(message)) throw failure;
      const fallback = await ImagePicker.launchImageLibraryAsync({...options, legacy: true, allowsEditing: false});
      if (!fallback.canceled && !fallback.assets?.length) throw new Error('No selected photo could be read');
      return fallback;
    }
  } catch {
    Alert.alert('Could not open photos', 'Please try again. If the problem continues, check that Photos or Files is enabled on your phone, then reopen ATL Xpress.');
    return cancelled;
  } finally {
    choosing = false;
  }
}
