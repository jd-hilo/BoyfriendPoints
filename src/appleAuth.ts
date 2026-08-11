declare global {
  interface Window {
    AppleID?: {
      auth: {
        init: (config: {
          clientId: string;
          scope: string;
          redirectURI: string;
          usePopup: boolean;
        }) => void;
        signIn: () => Promise<{
          authorization: { id_token: string; code: string };
          user?: {
            email?: string;
            name?: { firstName?: string; lastName?: string };
          };
        }>;
      };
    };
  }
}

const SCRIPT_SRC =
  'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';

function appleConfigured(): boolean {
  return Boolean(import.meta.env.VITE_APPLE_CLIENT_ID);
}

export function isAppleSignInAvailable(): boolean {
  return appleConfigured();
}

async function loadAppleScript(): Promise<void> {
  if (window.AppleID) return;
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SCRIPT_SRC}"]`,
    );
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener(
        'error',
        () => reject(new Error('Failed to load Apple Sign In')),
        { once: true },
      );
      return;
    }
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Apple Sign In'));
    document.head.appendChild(script);
  });
}

export async function signInWithApple(): Promise<{
  idToken: string;
  name?: string;
}> {
  const clientId = import.meta.env.VITE_APPLE_CLIENT_ID as string | undefined;
  if (!clientId) {
    throw new Error(
      'Apple Sign In is not configured. Add VITE_APPLE_CLIENT_ID (Services ID) to .env.',
    );
  }
  const redirectURI =
    (import.meta.env.VITE_APPLE_REDIRECT_URI as string | undefined) ||
    window.location.origin;

  await loadAppleScript();
  if (!window.AppleID) throw new Error('Apple Sign In failed to initialize');

  window.AppleID.auth.init({
    clientId,
    scope: 'name email',
    redirectURI,
    usePopup: true,
  });

  const response = await window.AppleID.auth.signIn();
  const idToken = response.authorization?.id_token;
  if (!idToken) throw new Error('Apple did not return an identity token');

  const first = response.user?.name?.firstName ?? '';
  const last = response.user?.name?.lastName ?? '';
  const name = `${first} ${last}`.trim() || undefined;
  return { idToken, name };
}
