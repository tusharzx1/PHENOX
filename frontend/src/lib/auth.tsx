import Link from 'next/link';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type AuthUser = {
  primaryEmailAddress?: {
    emailAddress?: string;
  };
  emailAddresses?: Array<{
    emailAddress?: string;
  }>;
};

type AuthContextValue = {
  isLoaded: boolean;
  isSignedIn: boolean;
  user: AuthUser | null;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  isLoaded: true,
  isSignedIn: false,
  user: null,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    const demoSignedIn = typeof window !== 'undefined' && localStorage.getItem('phenox_demo_auth') === 'true';
    setIsSignedIn(demoSignedIn);
    setIsLoaded(true);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    isLoaded,
    isSignedIn,
    user: isSignedIn
      ? {
          primaryEmailAddress: { emailAddress: 'admin@phenox.local' },
          emailAddresses: [{ emailAddress: 'admin@phenox.local' }],
        }
      : null,
    signOut: async () => {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('phenox_demo_auth');
        window.location.href = '/';
      }
      setIsSignedIn(false);
    },
  }), [isLoaded, isSignedIn]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useUser() {
  const { isLoaded, isSignedIn, user } = useContext(AuthContext);
  return { isLoaded, isSignedIn, user };
}

export function useClerk() {
  const { signOut } = useContext(AuthContext);
  return { signOut };
}

export function useAuth() {
  return {
    getToken: async () => null,
  };
}

export function useSignIn() {
  return {
    isLoaded: true,
    signIn: {
      create: async () => {
        throw {
          errors: [{ message: 'Clerk is disabled in local demo mode. Use admin demo credentials.' }],
        };
      },
      attemptFirstFactor: async () => {
        throw {
          errors: [{ message: 'Clerk is disabled in local demo mode. Use admin demo credentials.' }],
        };
      },
    },
    setActive: async () => {},
  };
}

export function SignIn() {
  return (
    <div className="w-[420px] max-w-full rounded-xl bg-black border border-[#FFD700]/30 p-8 shadow-[0_0_30px_rgba(255,215,0,0.12)]">
      <h1 className="text-2xl font-bold text-white mb-3">Public Access</h1>
      <p className="text-sm text-gray-300 mb-6">
        Local demo mode is active. Public analytics can be opened without Clerk authentication.
      </p>
      <div className="flex flex-col gap-3">
        <Link href="/public/analytics" className="text-center rounded bg-[#FFD700] px-4 py-3 font-semibold text-black hover:bg-[#FFD700]/85 transition-colors">
          Open Public Analytics
        </Link>
        <Link href="/admin/login" className="text-center rounded border border-white/15 px-4 py-3 font-semibold text-white hover:bg-white/5 transition-colors">
          Open Admin Demo Login
        </Link>
      </div>
    </div>
  );
}
