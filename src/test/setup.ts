import { vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

vi.mock('posthog-js', () => {
  const posthog = {
    init: vi.fn(),
    identify: vi.fn(),
    capture: vi.fn(),
    captureException: vi.fn(),
    reset: vi.fn(),
    get_distinct_id: vi.fn(() => 'test-distinct-id'),
    get_session_id: vi.fn(() => 'test-session-id'),
  };
  return { default: posthog };
});
