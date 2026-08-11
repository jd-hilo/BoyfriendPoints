import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';

export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

/** Sign in with Apple and return the identity token plus a display name (first sign-in only). */
export async function signInWithApple(): Promise<{
  idToken: string;
  name?: string;
}> {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  if (!credential.identityToken) {
    throw new Error('Apple did not return an identity token');
  }

  const first = credential.fullName?.givenName ?? '';
  const last = credential.fullName?.familyName ?? '';
  const name = `${first} ${last}`.trim() || undefined;

  return { idToken: credential.identityToken, name };
}
