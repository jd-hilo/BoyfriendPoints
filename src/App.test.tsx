// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import App from './App.tsx';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('<App />', () => {
  it('renders the leaderboard from the API', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify([
          { id: '1', name: 'Taylor', points: 15, createdAt: '2024-01-01' },
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    render(<App />);

    expect(
      screen.getByRole('heading', { name: /BoyfriendPoints/i }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Taylor')).toBeInTheDocument();
    });
    expect(screen.getByText('15 pts')).toBeInTheDocument();
  });
});
