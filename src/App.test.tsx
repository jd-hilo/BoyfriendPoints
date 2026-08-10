// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import App from './App.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('<App />', () => {
  it('shows the persona picker when signed out', async () => {
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
      expect(screen.getByText('Emma')).toBeInTheDocument();
    });
    expect(
      screen.getByText(/tap who you are/i),
    ).toBeInTheDocument();
  });
});
