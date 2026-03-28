import { useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { BarChart2, Layers, Shield, Users, ArrowRight } from 'lucide-react';

export default function PublicHome() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const particles: { x: number; y: number; vx: number; vy: number; r: number; a: number }[] = [];
    for (let i = 0; i < 100; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 1.5 + 0.5,
        a: Math.random() * 0.5 + 0.15,
      });
    }
    let raf: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,215,0,${p.a})`;
        ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  const features = [
    { icon: BarChart2, title: 'Real-Time Analytics', desc: 'Gold price, market cap, 24h change — live.' },
    { icon: Layers,   title: 'Batch Registry',     desc: 'Full transparency: every vault batch on-chain.' },
    { icon: Shield,   title: 'Proof of Reserve',   desc: 'Cryptographic verification of physical gold.' },
    { icon: Users,    title: 'Holder Leaderboard', desc: 'Top PGOLD holders ranked by balance & share.' },
  ];

  return (
    <div className="relative min-h-screen bg-[#050505] overflow-hidden flex flex-col">
      <Head>
        <title>PHENOX | Gold Analytics</title>
        <meta name="description" content="Institutional-grade gold RWA analytics on Monad Testnet." />
      </Head>

      <canvas ref={canvasRef} className="absolute inset-0 z-0 pointer-events-none opacity-40" />

      {/* glow orbs */}
      <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] bg-[#FFD700] opacity-[0.05] blur-[140px] rounded-full pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-[#FFD700] opacity-[0.03] blur-[120px] rounded-full pointer-events-none" />

      {/* Navbar */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-5 border-b border-[#FFD700]/10">
        <span className="font-mono font-bold text-xl text-[#FFD700]">&gt;_ PHENOX</span>
        <div className="flex items-center gap-4">
          <Link href="/analytics" className="text-sm text-gray-400 hover:text-white transition-colors font-mono hidden md:block">Analytics</Link>
          <a href="http://localhost:3000/admin/login" className="text-sm px-4 py-2 border border-[#FFD700]/30 text-[#FFD700] rounded hover:bg-[#FFD700]/10 transition font-mono">
            Admin
          </a>
        </div>
      </nav>

      {/* Hero */}
      <main className="relative z-10 flex flex-col items-center text-center px-4 pt-24 pb-16 flex-1">
        <div className="inline-flex items-center gap-2 bg-[#FFD700]/10 border border-[#FFD700]/20 rounded-full px-4 py-1 text-xs font-mono text-[#FFD700] mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-[#39FF14] animate-pulse" />
          LIVE · MONAD TESTNET
        </div>
        <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-none mb-6">
          Gold-Backed<br />
          <span className="text-[#FFD700] glow-gold">RWA Terminal</span>
        </h1>
        <p className="text-gray-400 max-w-xl text-lg mb-12 leading-relaxed">
          Institutional-grade transparency for physical gold tokenized on-chain. Track every gram, vault, and transaction — verified on Monad.
        </p>
        <Link href="/analytics">
          <button className="group flex items-center gap-3 px-10 py-4 bg-[#FFD700] text-black font-bold rounded-xl hover:bg-[#FFD700]/90 transition-all shadow-[0_0_40px_rgba(255,215,0,0.35)] text-base">
            Open Analytics Dashboard
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </Link>

        {/* Feature cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-20 w-full max-w-5xl">
          {features.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-white/[0.03] border border-[#FFD700]/10 rounded-xl p-5 text-left hover:border-[#FFD700]/30 transition-all">
              <Icon className="text-[#FFD700] mb-3" size={20} />
              <h3 className="font-semibold text-white text-sm mb-1">{title}</h3>
              <p className="text-gray-500 text-xs leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="relative z-10 border-t border-[#FFD700]/10 px-8 py-5 text-center">
        <p className="text-gray-700 text-xs font-mono">PHENOX Public Panel · Gold RWA · Monad Testnet · 2025</p>
      </footer>
    </div>
  );
}
