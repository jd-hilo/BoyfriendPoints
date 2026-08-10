import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.ts';
import { useAuth } from '../auth.tsx';
import { Avatar, Xp } from '../ui.tsx';
import { haptic } from '../utils.ts';
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

  const midTab: Tab = isWife ? 'requests' : 'submit';
  const rightTab: Tab = isWife ? 'manage' : 'redeem';
  const midLabel = isWife ? 'Review' : 'Submit';
  const rightLabel = isWife ? 'Manage' : 'Redeem';

  function go(next: Tab) {
    haptic(10);
    setTab(next);
    setTick((n) => n + 1);
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="search-pill">
          <Avatar
            name={user.name}
            color={user.color}
            src={user.avatarUrl}
            size={28}
          />
          <span className="wordmark">Love Receipts</span>
          {!isWife && (
            <span className="search-meta">
              <Xp value={user.points} size={16} />
            </span>
          )}
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
          <Avatar
            name={user.name}
            color={user.color}
            src={user.avatarUrl}
            size={30}
          />
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

        <div className="tab-fab-slot">
          <button
            type="button"
            className={`fab ${tab === midTab ? 'active' : ''}`}
            onClick={() => go(midTab)}
            aria-label={midLabel}
          >
            {isWife ? (
              pending > 0 ? (
                <span className="fab-count">{pending}</span>
              ) : (
                <CheckIcon />
              )
            ) : (
              <span className="fab-plus-gem">
                <PlusIcon />
                <span className="fab-gem" aria-hidden>
                  💎
                </span>
              </span>
            )}
          </button>
          <span className={`fab-label ${tab === midTab ? 'active' : ''}`}>
            {midLabel}
          </span>
        </div>

        <button
          type="button"
          className={`tab ${tab === rightTab ? 'active' : ''}`}
          onClick={() => go(rightTab)}
        >
          <GiftIcon active={tab === rightTab} />
          <span className="tab-label">{rightLabel}</span>
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
