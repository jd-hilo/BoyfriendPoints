import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.ts';
import { useAuth } from '../auth.tsx';
import { Avatar } from '../ui.tsx';
import Feed from './Feed.tsx';
import Submit from './Submit.tsx';
import Redeem from './Redeem.tsx';
import WifeRequests from './WifeRequests.tsx';
import WifeManage from './WifeManage.tsx';

type Tab = 'feed' | 'submit' | 'redeem' | 'requests' | 'manage';

export default function MainApp() {
  const { user, logout, refresh } = useAuth();
  const [tab, setTab] = useState<Tab>('feed');
  const [tick, setTick] = useState(0);
  const [pending, setPending] = useState(0);

  const isWife = user?.role === 'wife';

  const bump = useCallback(() => {
    setTick((t) => t + 1);
    void refresh();
  }, [refresh]);

  const loadPending = useCallback(async () => {
    if (!isWife) return;
    const [subs, redemptions] = await Promise.all([
      api.submissions(),
      api.redemptions(),
    ]);
    setPending(subs.length + redemptions.length);
  }, [isWife]);

  useEffect(() => {
    void loadPending();
  }, [loadPending, tick]);

  if (!user) return null;

  const fabTab: Tab = isWife ? 'requests' : 'submit';
  const sideTab: Tab = isWife ? 'manage' : 'redeem';
  const fabLabel = isWife ? 'Requests' : 'Submit';
  const sideLabel = isWife ? 'Manage' : 'Redeem';

  function go(next: Tab) {
    setTab(next);
    setTick((n) => n + 1);
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="search-pill">
          <Avatar name={user.name} color={user.color} size={28} />
          <span className="wordmark">boyfriendpoints</span>
          {!isWife && <span className="search-meta">{user.points} pts</span>}
          {isWife && pending > 0 && (
            <span className="search-meta">{pending} pending</span>
          )}
        </div>
        <button
          className="header-icon-btn"
          onClick={() => void logout()}
          aria-label="Switch persona"
          title="Switch persona"
        >
          <Avatar name={user.name} color={user.color} size={28} />
        </button>
      </header>

      <main className="app-main">
        {tab === 'feed' && <Feed key={`feed-${tick}`} />}
        {tab === 'submit' && <Submit key={`submit-${tick}`} onDone={bump} />}
        {tab === 'redeem' && (
          <Redeem key={`redeem-${tick}`} user={user} onChange={bump} />
        )}
        {tab === 'requests' && (
          <WifeRequests key={`req-${tick}`} onChange={bump} />
        )}
        {tab === 'manage' && <WifeManage key={`man-${tick}`} />}
      </main>

      <nav className="tab-bar" aria-label="Main">
        <button
          type="button"
          className={`tab ${tab === 'feed' ? 'active' : ''}`}
          onClick={() => go('feed')}
        >
          <HomeIcon active={tab === 'feed'} />
          <span className="tab-label">Home</span>
        </button>

        <button
          type="button"
          className={`tab ${tab === sideTab ? 'active' : ''}`}
          onClick={() => go(sideTab)}
        >
          <GiftIcon active={tab === sideTab} />
          <span className="tab-label">{sideLabel}</span>
        </button>

        <div className="tab-fab-slot">
          <button
            type="button"
            className={`fab ${tab === fabTab ? 'active' : ''}`}
            onClick={() => go(fabTab)}
            aria-label={fabLabel}
          >
            {isWife ? (
              pending > 0 ? (
                <span className="fab-count">{pending}</span>
              ) : (
                <CheckIcon />
              )
            ) : (
              <PlusIcon />
            )}
          </button>
          <span className={`fab-label ${tab === fabTab ? 'active' : ''}`}>
            {fabLabel}
          </span>
        </div>

        <button
          type="button"
          className="tab"
          onClick={() => void logout()}
          aria-label="Switch persona"
        >
          <span className="tab-avatar">
            <Avatar name={user.name} color={user.color} size={26} />
          </span>
          <span className="tab-label">Me</span>
        </button>
      </nav>
    </div>
  );
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg className="tab-svg" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GiftIcon({ active }: { active: boolean }) {
  return (
    <svg className="tab-svg" viewBox="0 0 24 24" aria-hidden>
      <rect
        x="4"
        y="8"
        width="16"
        height="12"
        rx="2"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M4 12h16M12 8v12"
        fill="none"
        stroke={active ? '#fff' : 'currentColor'}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M12 5v14M5 12h14"
        stroke="#fff"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden>
      <path
        d="m5 12 5 5L19 7"
        fill="none"
        stroke="#fff"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
