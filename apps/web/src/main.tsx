import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { AuthScreen } from './auth/AuthScreen';
import './index.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');

function Root() {
  const auth = useAuth();
  if (auth.mode === 'google' && auth.status !== 'authenticated') return <AuthScreen />;
  return <App />;
}

createRoot(container).render(
  <StrictMode>
    <AuthProvider>
      <Root />
    </AuthProvider>
  </StrictMode>,
);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}
