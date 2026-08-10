// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import App from './App.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('<App />', () => {
  it('shows the sign-up screen when signed out', async () => {
    render(<App />);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /create my account/i }),
      ).toBeInTheDocument();
    });

    expect(screen.getByPlaceholderText(/your name/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/email/i)).toBeInTheDocument();
  });
});
