import * as Sharing from 'expo-sharing';

export type ReceiptKind = 'request' | 'earn' | 'redeem' | 'fulfill' | 'approve';

export interface ReceiptData {
  kind: ReceiptKind;
  emoji: string;
  title: string;
  points: number;
  fromName: string;
  toName: string;
  meta?: string;
  note?: string;
}

export const RECEIPT_HEADLINE: Record<ReceiptKind, string> = {
  request: 'Request sent',
  earn: 'Points earned',
  redeem: 'Prize redeemed',
  fulfill: 'Prize given',
  approve: 'You approved it',
};

export function signFor(kind: ReceiptKind): '+' | '−' {
  return kind === 'redeem' || kind === 'fulfill' ? '−' : '+';
}

/** Share a receipt image already captured (via react-native-view-shot) to a local file URI. */
export async function shareReceiptImage(
  uri: string,
  data?: ReceiptData,
): Promise<void> {
  const available = await Sharing.isAvailableAsync().catch(() => false);
  if (!available) throw new Error('Sharing is not available on this device');
  await Sharing.shareAsync(uri, {
    mimeType: 'image/png',
    dialogTitle: data
      ? `${data.emoji} ${data.title} · LoveReceipts`
      : 'LoveReceipts',
    UTI: 'public.png',
  });
}
