import { Alert } from 'react-native';

export function confirmReport(onReason: (reason: string) => void) {
  Alert.alert(
    'Report this?',
    'They won’t be told it was you. We’ll review it.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Harassment', onPress: () => onReason('Harassment') },
      { text: 'Spam', onPress: () => onReason('Spam') },
      { text: 'Inappropriate', onPress: () => onReason('Inappropriate') },
      { text: 'Other', onPress: () => onReason('Other') },
    ],
  );
}
