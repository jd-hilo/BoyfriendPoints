import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import posthog from 'posthog-js';
import { PostHogErrorBoundary, PostHogProvider } from '@posthog/react';
import App from './App.tsx';
import './index.css';

const token = import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN;
if (token) {
  posthog.init(token, {
    api_host:
      import.meta.env.VITE_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
    defaults: '2026-01-30',
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PostHogProvider client={posthog}>
      <PostHogErrorBoundary
        fallback={
          <div className="splash">
            <span className="wordmark big">Something went wrong</span>
            <p>Refresh to try again.</p>
          </div>
        }
      >
        <App />
      </PostHogErrorBoundary>
    </PostHogProvider>
  </StrictMode>,
);
