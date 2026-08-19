import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

export type VerifiedIdentity = {
  email: string;
  name: string;
  subject: string;
  provider: 'neon' | 'apple';
};

function requireEmail(payload: JWTPayload, label: string): string {
  const email = typeof payload.email === 'string' ? payload.email.trim() : '';
  if (!email) throw new Error(`${label} token is missing an email`);
  return email;
}

function displayName(payload: JWTPayload, email: string): string {
  if (typeof payload.name === 'string' && payload.name.trim()) {
    return payload.name.trim();
  }
  const local = email.split('@')[0]?.trim();
  return local || 'LoveReceipts user';
}

let neonJwks: ReturnType<typeof createRemoteJWKSet> | undefined;
let appleJwks: ReturnType<typeof createRemoteJWKSet> | undefined;

function getNeonJwks(jwksUrl: string) {
  if (!neonJwks) neonJwks = createRemoteJWKSet(new URL(jwksUrl));
  return neonJwks;
}

function getAppleJwks() {
  if (!appleJwks) {
    appleJwks = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));
  }
  return appleJwks;
}

export async function verifyNeonIdentityToken(
  token: string,
  opts: { jwksUrl: string; issuer: string },
): Promise<VerifiedIdentity> {
  const { payload } = await jwtVerify(token, getNeonJwks(opts.jwksUrl), {
    issuer: opts.issuer,
    audience: opts.issuer,
  });
  const email = requireEmail(payload, 'Neon');
  const subject =
    (typeof payload.sub === 'string' && payload.sub) ||
    (typeof payload.id === 'string' && payload.id) ||
    email;
  return {
    email,
    name: displayName(payload, email),
    subject,
    provider: 'neon',
  };
}

export async function verifyAppleIdentityToken(
  token: string,
  clientId: string,
): Promise<VerifiedIdentity> {
  const { payload } = await jwtVerify(token, getAppleJwks(), {
    issuer: 'https://appleid.apple.com',
    audience: clientId,
  });
  const email = requireEmail(payload, 'Apple');
  const subject =
    typeof payload.sub === 'string' && payload.sub
      ? payload.sub
      : email;
  return {
    email,
    name: displayName(payload, email),
    subject,
    provider: 'apple',
  };
}

export function neonAuthEnv(env: {
  NEON_AUTH_URL?: string;
  NEON_JWKS_URL?: string;
  VITE_NEON_AUTH_URL?: string;
}): { authUrl: string; jwksUrl: string; issuer: string } {
  const authUrl =
    env.NEON_AUTH_URL?.trim() ||
    env.VITE_NEON_AUTH_URL?.trim() ||
    '';
  if (!authUrl) throw new Error('NEON_AUTH_URL is not configured');
  const base = authUrl.replace(/\/$/, '');
  // Neon JWTs use the neonauth host origin as iss/aud (no /neondb/auth path).
  const issuer = new URL(base).origin;
  const jwksUrl =
    env.NEON_JWKS_URL?.trim() || `${base}/.well-known/jwks.json`;
  return { authUrl: base, jwksUrl, issuer };
}

export type NeonAuthEnvInput = Parameters<typeof neonAuthEnv>[0];

function neonErrorMessage(data: unknown, fallback: string): string {
  if (!data || typeof data !== 'object') return fallback;
  const rec = data as Record<string, unknown>;
  if (typeof rec.message === 'string' && rec.message.trim()) return rec.message;
  if (typeof rec.error === 'string' && rec.error.trim()) return rec.error;
  if (rec.error && typeof rec.error === 'object') {
    const nested = rec.error as Record<string, unknown>;
    if (typeof nested.message === 'string' && nested.message.trim()) {
      return nested.message;
    }
  }
  return fallback;
}

async function neonAuthFetch(
  authUrl: string,
  path: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; message: string }> {
  const url = `${authUrl}${path.startsWith('/') ? path : `/${path}`}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'Could not send a reset code. Try again.',
    };
  }
  const data: unknown = await res.json().catch(() => ({}));
  return {
    ok: res.ok,
    status: res.status,
    message: neonErrorMessage(
      data,
      res.ok ? '' : 'Could not send a reset code. Try again.',
    ),
  };
}

/** Ask Neon Auth to email a 6-digit reset code via the shared SMTP sender. */
export async function requestNeonPasswordReset(
  email: string,
  env: NeonAuthEnvInput,
): Promise<void> {
  const { authUrl } = neonAuthEnv(env);
  const body = { email: email.trim().toLowerCase() };
  const primary = await neonAuthFetch(
    authUrl,
    '/email-otp/request-password-reset',
    body,
  );
  if (primary.ok) return;
  if (primary.status === 404) {
    const fallback = await neonAuthFetch(
      authUrl,
      '/forget-password/email-otp',
      body,
    );
    if (fallback.ok) return;
    if (fallback.status >= 500) {
      throw new Error(fallback.message);
    }
    throw new Error(
      'Password reset emails are not enabled. Turn on Email OTP in Neon Auth → Plugins.',
    );
  }
  if (primary.status >= 500) {
    throw new Error(primary.message);
  }
}

/** Verify the emailed code and set the Neon Auth password. */
export async function resetNeonPasswordWithOtp(
  input: { email: string; otp: string; password: string },
  env: NeonAuthEnvInput,
): Promise<void> {
  const { authUrl } = neonAuthEnv(env);
  const result = await neonAuthFetch(authUrl, '/email-otp/reset-password', {
    email: input.email.trim().toLowerCase(),
    otp: input.otp.trim(),
    password: input.password,
  });
  if (!result.ok) {
    throw new Error(
      result.status >= 500
        ? result.message
        : 'Invalid or expired code. Request a new one.',
    );
  }
}
