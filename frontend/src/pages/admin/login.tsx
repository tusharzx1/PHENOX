import { useSignIn } from '@/lib/auth';
import { useState } from 'react';
import { useRouter } from 'next/router';

export default function AdminLogin() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [status, setStatus] = useState('');
  const router = useRouter();

  const handleDemoMode = () => {
    // Loosened the demo validation so typing just 'admin' works seamlessly 
    if (email.toLowerCase().includes('admin')) {
      setShowCodeInput(true);
      setStatus('DEMO MODE ACTIVE: Enter password / OTP');
      return true;
    }
    return false;
  };

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (handleDemoMode()) return;
    
    if (!isLoaded) return;
    try {
      await signIn.create({ identifier: email, strategy: 'email_code' });
      setShowCodeInput(true);
      setStatus('OTP sent to your email');
    } catch (err: any) {
      setStatus(err.errors ? err.errors[0]?.message : 'Clerk SDK error or invalid keys.');
    }
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (email.toLowerCase().includes('admin') && code === 'admin123') {
      localStorage.setItem('phenox_demo_auth', 'true');
      router.push('/admin/dashboard');
      return;
    }
    
    if (!isLoaded) return;
    try {
      const attempt = await signIn.attemptFirstFactor({ strategy: 'email_code', code });
      if (attempt.status === 'needs_second_factor') {
        await attempt.authenticateWithPasskey();
      } else if (attempt.status === 'complete') {
        await setActive({ session: attempt.createdSessionId });
        router.push('/admin/dashboard');
      }
    } catch (err: any) {
      setStatus(err.errors ? err.errors[0]?.message : 'Invalid code or demo credentials.');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050505] relative overflow-hidden">
      {/* Decorative Cyberpunk Lighting */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vh] bg-[#00E5FF] opacity-5 blur-[150px] rounded-full pointer-events-none" />

      <div className="w-96 rounded-xl bg-black border border-[#00E5FF]/30 p-8 shadow-[0_0_30px_rgba(0,229,255,0.1)] relative z-10 backdrop-blur-sm">
        <h1 className="mb-2 text-3xl font-bold text-white text-glow tracking-tighter">PHENOX</h1>
        <h2 className="mb-6 text-sm font-mono text-[#00E5FF] tracking-widest uppercase">&gt; Admin Authentication</h2>
        
        {!showCodeInput ? (
          <form onSubmit={sendCode}>
            <input
              type="text"
              placeholder="Admin ID (Email)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mb-4 w-full rounded bg-white/5 border border-white/10 p-3 text-white focus:border-[#00E5FF] focus:outline-none focus:bg-white/10 transition-colors font-mono text-sm"
              required
            />
            <button type="submit" className="w-full rounded bg-[#00E5FF] p-3 font-bold text-black hover:bg-[#00E5FF]/80 transition-colors shadow-[0_0_15px_rgba(0,229,255,0.4)]">
              INITIALIZE OTP
            </button>
          </form>
        ) : (
          <form onSubmit={verifyCode}>
            <input
              type="password"
              placeholder="Password / 6-digit Code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="mb-4 w-full rounded bg-white/5 border border-white/10 p-3 text-white focus:border-[#00E5FF] focus:outline-none focus:bg-white/10 transition-colors font-mono text-sm"
              required
            />
            <button type="submit" className="w-full rounded bg-[#39FF14] p-3 font-bold text-black hover:bg-[#39FF14]/80 transition-colors shadow-[0_0_15px_rgba(57,255,20,0.4)]">
              VERIFY & DECRYPT
            </button>
          </form>
        )}
        
        <div className="mt-6 p-3 bg-white/5 border border-white/10 rounded">
          <p className="text-center text-gray-400 font-mono text-xs">{status || "Awaiting credentials..."}</p>
        </div>
      </div>
    </div>
  );
}
