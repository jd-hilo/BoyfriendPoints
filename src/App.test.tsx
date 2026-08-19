// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('<App />', () => {
  it('shows sign-in and demo personas when signed out', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/api/personas')) {
        return new Response(
          JSON.stringify([
            {
              id: '1',
              name: 'Emma',
              email: 'emma@demo.boyfriendpoints.app',
              role: 'wife',
              color: '#008CFF',
              friendIds: [],
              points: 0,
              onboarded: true,
              partnerName: 'Noah',
            },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify({ error: 'unexpected' }), {
        status: 500,
      });
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/you.ll use this to sign in/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign in' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /apple/i })).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('you@email.com'), {
      target: { value: 'emma@demo.boyfriendpoints.app' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '←' }));
    fireEvent.click(screen.getByRole('button', { name: /try the demo/i }));

    await waitFor(() => {
      expect(screen.getByText('Emma')).toBeInTheDocument();
    });
  });

  it('starts a forgot-password code step from sign-in', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/api/personas')) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.endsWith('/api/auth/forgot-password')) {
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: 'unexpected' }), {
        status: 500,
      });
    });

    render(<App />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText('you@email.com')).toBeInTheDocument();
    });
    fireEvent.change(screen.getByPlaceholderText('you@email.com'), {
      target: { value: 'ada@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: /forgot password/i }));

    await waitFor(() => {
      expect(screen.getByText(/enter the code we emailed/i)).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText('123456')).toBeInTheDocument();
  });
});
