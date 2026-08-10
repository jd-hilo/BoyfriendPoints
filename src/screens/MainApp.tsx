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

  const tabs: Array<{ id: Tab; label: string; icon: string; badge?: number }> =
    isWife
      ? [
          { id: 'feed', label: 'Feed', icon: '🏠' },
          { id: 'requests', label: 'Requests', icon: '✅', badge: pending },
          { id: 'manage', label: 'Manage', icon: '🎁' },
        ]
      : [
          { id: 'feed', label: 'Feed', icon: '🏠' },
          { id: 'submit', label: 'Submit', icon: '➕' },
          { id: 'redeem', label: 'Redeem', icon: '🎁' },
        ];

  return (
    <div className="app">
      <header className="app-header">
        <span className="wordmark">boyfriendpoints</span>
        <div className="header-right">
          {!isWife && <span className="points-chip">{user.points} pts</span>}
          <button className="avatar-btn" onClick={logout} aria-label="Sign out">
            <Avatar name={user.name} color={user.color} size={32} />
          </button>
        </div>
      </header>

      <main className="app-main">
        {tab === 'feed' && <Feed key={`feed-${tick}`} />}
        {tab === 'submit' && <Submit key={`submit-${tick}`} onDone={bump} />}
        {tab === 'redeem' && (
          <Redeem key={`redeem-${tick}`} user={user} onChange={bump} />
        )}
        {tab === 'requests' && <WifeRequests key={`req-${tick}`} onChange={bump} />}
        {tab === 'manage' && <WifeManage key={`man-${tick}`} />}
      </main>

      <nav className="tab-bar">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => {
              setTab(t.id);
              setTick((n) => n + 1);
            }}
          >
            <span className="tab-icon">
              {t.icon}
              {t.badge ? <span className="tab-badge">{t.badge}</span> : null}
            </span>
            <span className="tab-label">{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
