import { createAuthClient } from '@neondatabase/neon-js/auth';

const authUrl = (import.meta.env.VITE_NEON_AUTH_URL as string | undefined)?.replace(
  /\/$/,
  '',
);

if (!authUrl) {
  console.warn('VITE_NEON_AUTH_URL is not set — email/password auth will fail');
}

type AuthClient = {
  signUp: {
    email: (input: {
      name: string;
      email: string;
      password: string;
    }) => Promise<{ error?: { message?: string } | null }>;
  };
  signIn: {
    email: (input: {
      email: string;
      password: string;
    }) => Promise<{ error?: { message?: string } | null }>;
  };
  signOut: () => Promise<unknown>;
  getJWTToken?: () => Promise<string | null>;
};

export const neonAuth: AuthClient = createAuthClient(
  authUrl ?? 'http://localhost/missing-neon-auth-url',
) as unknown as AuthClient;

export async function neonSignUp(input: {
  name: string;
  email: string;
  password: string;
}): Promise<void> {
  const result = await neonAuth.signUp.email({
    name: input.name,
    email: input.email,
    password: input.password,
  });
  if (result.error) throw new Error(result.error.message || 'Sign up failed');
}

export async function neonSignIn(input: {
  email: string;
  password: string;
}): Promise<void> {
  const result = await neonAuth.signIn.email({
    email: input.email,
    password: input.password,
  });
  if (result.error) throw new Error(result.error.message || 'Sign in failed');
}

export async function neonSignOut(): Promise<void> {
  await neonAuth.signOut().catch(() => undefined);
}

async function fetchJwtFromAuthUrl(): Promise<string | null> {
  if (!authUrl) return null;
  const res = await fetch(`${authUrl}/token`, {
    method: 'GET',
    credentials: 'include',
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { token?: string };
  return data.token ?? null;
}

export async function neonIdToken(): Promise<string> {
  const fromClient = neonAuth.getJWTToken
    ? await neonAuth.getJWTToken()
    : null;
  const token = fromClient ?? (await fetchJwtFromAuthUrl());
  if (!token) throw new Error('Could not get Neon auth token');
  return token;
}
