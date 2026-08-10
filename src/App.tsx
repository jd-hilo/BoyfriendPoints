import { AuthProvider, useAuth } from './auth.tsx';
import { PhoneFrame } from './ui.tsx';
import AuthScreen from './screens/AuthScreen.tsx';
import Onboarding from './screens/Onboarding.tsx';
import MainApp from './screens/MainApp.tsx';

function Router() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="splash">
        <span className="wordmark big">Love Receipts</span>
      </div>
    );
  }
  if (!user) return <AuthScreen />;
  if (user.role === 'wife' && !user.onboarded) return <Onboarding />;
  return <MainApp />;
}

export default function App() {
  return (
    <AuthProvider>
      <PhoneFrame>
        <Router />
      </PhoneFrame>
    </AuthProvider>
  );
}
