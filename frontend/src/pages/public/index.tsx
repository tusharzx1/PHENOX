import { useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { Layers, BarChart2, Shield, Eye } from 'lucide-react';
import { useClerk, useUser } from '@/lib/auth';

export default function PublicHome() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { signOut } = useClerk();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const particles: { x: number; y: number; vx: number; vy: number; size: number; alpha: number }[] = [];
    for (let i = 0; i < 80; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        size: Math.random() * 2 + 0.5,
        alpha: Math.random() * 0.6 + 0.2,
      });
    }
    let frame: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 196, 0, ${p.alpha})`;
        ctx.fill();
      });
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, []);

  const handleLogout = async () => {
    await signOut();
  };

  if (!isLoaded) {
    return <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center font-mono">Loading authentication...</div>;
  }

  const features = [
    { icon: BarChart2, title: 'Real-Time Analytics', desc: 'Live gold price, on-chain supply, and market cap.' },
    { icon: Layers, title: 'Gold Batch Registry', desc: 'Every vault batch on-chain — weight, purity, location.' },
    { icon: Shield, title: 'Proof of Reserve', desc: 'Transparent audit trail verified on Monad Testnet.' },
    { icon: Eye, title: 'Holder Leaderboard', desc: 'Top PGOLD holders ranked by balance and % of supply.' },
  ];

  return (
    <div className="relative min-h-screen bg-[#050505] text-white overflow-hidden">
      <Head>
        <title>PHENOX | Gold Analytics</title>
        <meta name="description" content="Real-time gold-backed RWA analytics on Monad Testnet." />
      </Head>

      <canvas ref={canvasRef} className="absolute inset-0 z-0 pointer-events-none opacity-50" />

      {/* Navbar */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-5 border-b border-[#FFD700]/10">
        <div className="font-mono font-bold text-xl text-[#FFD700] tracking-widest">&gt;_ PHENOX</div>
        <div className="flex items-center gap-6">
          <span className="text-xs text-gray-500 font-mono hidden md:block">
            {user?.primaryEmailAddress?.emailAddress || 'Guest Session'}
          </span>
          <Link href="/public/analytics" className="text-sm text-gray-400 hover:text-[#FFD700] transition-colors font-mono">Analytics</Link>
          <Link href="/admin/login" className="text-sm px-4 py-2 border border-[#FFD700]/40 text-[#FFD700] rounded hover:bg-[#FFD700]/10 transition-all font-mono">Admin Login</Link>
          {isSignedIn && (
            <button onClick={handleLogout} className="text-sm px-4 py-2 border border-red-400/40 text-red-300 rounded hover:bg-red-400/10 transition-all font-mono">
              Logout
            </button>
          )}
        </div>
      </nav>

      {/* Hero */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center px-4 pt-24 pb-16">
        <div className="inline-flex items-center gap-2 bg-[#FFD700]/10 border border-[#FFD700]/30 rounded-full px-4 py-1 text-xs font-mono text-[#FFD700] mb-8">
          <span className="w-2 h-2 rounded-full bg-[#39FF14] animate-pulse"></span>
          LIVE ON MONAD TESTNET
        </div>

        <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-6 leading-none">
          Gold-Backed <br />
          <span className="text-[#FFD700]" style={{ textShadow: '0 0 40px rgba(255,215,0,0.5)' }}>RWA Analytics</span>
        </h1>

        <p className="text-gray-400 max-w-xl text-lg mb-10 leading-relaxed">
          Institutional-grade transparency for physical gold tokenized on the blockchain.
          Track every gram, every vault, every transaction — on-chain.
        </p>

        <Link href="/public/analytics">
          <button className="px-10 py-4 bg-[#FFD700] text-black font-bold rounded-lg hover:bg-[#FFD700]/90 transition-all shadow-[0_0_30px_rgba(255,215,0,0.4)] text-base">
            Open Analytics Dashboard →
          </button>
        </Link>
      </div>

      {/* Feature Cards */}
      <div className="relative z-10 max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4 px-8 pb-20">
        {features.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="bg-white/[0.03] border border-[#FFD700]/10 rounded-xl p-6 hover:border-[#FFD700]/30 transition-all group">
            <Icon className="text-[#FFD700] mb-4" size={24} />
            <h3 className="font-bold text-white mb-2">{title}</h3>
            <p className="text-gray-500 text-sm">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
