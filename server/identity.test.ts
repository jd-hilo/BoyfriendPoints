import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  requestNeonPasswordReset,
  resetNeonPasswordWithOtp,
} from './identity.ts';

const env = { NEON_AUTH_URL: 'https://auth.example.com/neondb/auth' };

afterEach(() => {
  vi.restoreAllMocks();
});

describe('requestNeonPasswordReset', () => {
  it('posts a lowercased email to the Neon OTP endpoint', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 200 }),
    );
    await requestNeonPasswordReset('Ada@Example.com', env);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe(
      'https://auth.example.com/neondb/auth/email-otp/request-password-reset',
    );
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({
      email: 'ada@example.com',
    });
  });

  it('errors when neither Neon reset endpoint exists', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('not found', { status: 404 }),
    );
    await expect(
      requestNeonPasswordReset('ada@example.com', env),
    ).rejects.toThrow(/email otp/i);
  });

  it('falls back to the deprecated path when the new one 404s', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input) => {
        const url = String(input);
        if (url.endsWith('/email-otp/request-password-reset')) {
          return new Response('not found', { status: 404 });
        }
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      });
    await requestNeonPasswordReset('ada@example.com', env);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain(
      '/forget-password/email-otp',
    );
  });
});

describe('resetNeonPasswordWithOtp', () => {
  it('throws a friendly error on a bad code', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: 'INVALID_OTP' }), { status: 400 }),
    );
    await expect(
      resetNeonPasswordWithOtp(
        { email: 'ada@example.com', otp: '000000', password: 'new-pass-word' },
        env,
      ),
    ).rejects.toThrow(/invalid or expired code/i);
  });
});
