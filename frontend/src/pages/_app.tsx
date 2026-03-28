import { useEffect } from 'react';
import { AuthProvider } from '@/lib/auth';
import { initFirebaseAnalytics } from '@/lib/firebase';
import type { AppProps } from 'next/app';
import '../styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    void initFirebaseAnalytics();
  }, []);

  return (
    <AuthProvider>
      <Component {...pageProps} />
    </AuthProvider>
  );
}
