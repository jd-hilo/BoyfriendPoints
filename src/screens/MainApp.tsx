import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.ts';
import { useAuth } from '../auth.tsx';
import { Avatar } from '../ui.tsx';
import Feed from './Feed.tsx';
import Submit from './Submit.tsx';
import Redeem from './Redeem.tsx';
import WifeRequests from './WifeRequests.tsx';
import WifeManage from './WifeManage.tsx';

type Tab = 'feed' | 'submit' | 'redeem' | 'requests' | 'manage' | 'me';

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

  function go(next: Tab) {
    if (next === 'me') {
      void logout();
      return;
    }
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
          onClick={() => go('me')}
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

      <div className="tab-bar-wrap">
        <button
          className={`fab ${tab === fabTab ? 'active' : ''}`}
          onClick={() => go(fabTab)}
          aria-label={fabLabel}
        >
          {isWife ? (pending > 0 ? pending : '✓') : '+'}
        </button>
        <span className={`fab-label ${tab === fabTab ? 'active' : ''}`}>
          {fabLabel}
        </span>
        <nav className="tab-bar">
          <button
            className={`tab ${tab === 'feed' ? 'active' : ''}`}
            onClick={() => go('feed')}
          >
            <span className="tab-icon" aria-hidden>
              ⌂
            </span>
            <span className="tab-label">Home</span>
          </button>
          <button
            className={`tab ${tab === sideTab ? 'active' : ''}`}
            onClick={() => go(sideTab)}
          >
            <span className="tab-icon" aria-hidden>
              {isWife ? '▣' : '◈'}
              {isWife && pending > 0 ? (
                <span className="tab-badge">{pending}</span>
              ) : null}
            </span>
            <span className="tab-label">{isWife ? 'Manage' : 'Redeem'}</span>
          </button>
          <span aria-hidden />
          <span aria-hidden />
          <button className="tab" onClick={() => go('me')}>
            <span className="tab-icon">
              <Avatar name={user.name} color={user.color} size={26} />
            </span>
            <span className="tab-label">Me</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
