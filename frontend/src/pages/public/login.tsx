import { SignIn, useUser } from '@/lib/auth';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

export default function PublicLogin() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.replace('/public/analytics');
    }
  }, [isLoaded, isSignedIn, router]);

  return (
    <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center px-4">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vh] bg-[#FFD700] opacity-5 blur-[150px] rounded-full pointer-events-none" />
      <div className="relative z-10">
        <SignIn
          routing="path"
          path="/public/login"
          signUpUrl="/public/login"
          afterSignInUrl="/public/analytics"
          appearance={{
            variables: {
              colorPrimary: '#FFD700',
              colorText: '#ffffff',
              colorBackground: '#050505',
              colorInputBackground: 'rgba(255,255,255,0.05)',
              colorInputText: '#ffffff',
            },
            elements: {
              card: 'bg-black border border-[#FFD700]/30 shadow-[0_0_30px_rgba(255,215,0,0.12)]',
              formButtonPrimary: 'bg-[#FFD700] text-black hover:bg-[#FFD700]/85',
              footerActionLink: 'text-[#FFD700] hover:text-[#FFD700]',
              headerTitle: 'text-white',
              headerSubtitle: 'text-gray-300',
            },
          }}
        />
      </div>
    </div>
  );
}
