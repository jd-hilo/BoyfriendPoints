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
