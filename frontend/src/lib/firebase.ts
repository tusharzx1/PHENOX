import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: 'AIzaSyBmCdxDzk076ZZxQ69WD3BZDAlcUtMXMLA',
  authDomain: 'phenox-gold-rwa.firebaseapp.com',
  projectId: 'phenox-gold-rwa',
  storageBucket: 'phenox-gold-rwa.firebasestorage.app',
  messagingSenderId: '924629007825',
  appId: '1:924629007825:web:d9497cc9c8049f0b4774f0',
  measurementId: 'G-1ER8N3KZQ7',
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

export async function initFirebaseAnalytics() {
  if (typeof window === 'undefined') return null;
  const supported = await isSupported();
  return supported ? getAnalytics(firebaseApp) : null;
}
