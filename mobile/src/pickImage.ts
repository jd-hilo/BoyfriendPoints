import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { api } from './api';

export async function pickAndUploadPhoto(opts?: {
  square?: boolean;
}): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    throw new Error('Allow photo access to pick a picture');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: opts?.square ? [1, 1] : undefined,
    quality: 0.85,
  });
  if (result.canceled || !result.assets[0]) return null;

  const resized = await ImageManipulator.manipulateAsync(
    result.assets[0].uri,
    [{ resize: { width: opts?.square ? 640 : 1080 } }],
    {
      compress: 0.72,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    },
  );
  if (!resized.base64) throw new Error('Could not read that photo');

  const { url } = await api.uploadMedia('image/jpeg', resized.base64);
  return url;
}
