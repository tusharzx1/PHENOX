import { useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const cols = Math.floor(canvas.width / 20) + 1;
    const drops = new Array(cols).fill(1);
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$+-*/=|{}'.split('');

    let id: number;
    const draw = () => {
      ctx.fillStyle = 'rgba(5,5,5,0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = '14px monospace';
      drops.forEach((d, i) => {
        const ch = chars[Math.floor(Math.random() * chars.length)];
        const gold = Math.random() > 0.7;
        ctx.fillStyle = gold ? 'rgba(255,215,0,0.6)' : 'rgba(0,229,255,0.35)';
        ctx.fillText(ch, i * 20, d * 20);
        if (d * 20 > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      });
      id = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="relative min-h-screen bg-[#050505] text-white overflow-hidden flex flex-col">
      <Head>
        <title>PHENOX | Gold RWA Terminal</title>
        <meta name="description" content="PHENOX – Institutional Gold Asset Management on Monad Testnet" />
      </Head>

      <canvas ref={canvasRef} className="absolute inset-0 z-0 pointer-events-none opacity-30" />

      {/* Glow orbs */}
      <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-[#FFD700] opacity-[0.04] blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-[#00E5FF] opacity-[0.04] blur-[120px] rounded-full pointer-events-none" />

      <main className="relative z-10 flex flex-col items-center justify-center flex-1 px-4 text-center">
        {/* badge */}
        <div className="inline-flex items-center gap-2 mb-8 px-4 py-1.5 bg-white/[0.04] border border-white/10 rounded-full text-xs font-mono text-gray-400">
          <span className="w-1.5 h-1.5 rounded-full bg-[#39FF14] animate-pulse" />
          MONAD TESTNET LIVE
        </div>

        <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-4 leading-none">
          <span style={{ textShadow: '0 0 60px rgba(255,215,0,0.3)' }} className="text-[#FFD700]">PHENOX</span>
        </h1>
        <p className="text-gray-400 max-w-lg text-lg mb-12">
          Institutional-grade Real World Asset infrastructure for physical gold — tokenized, tracked, and verified on-chain.
        </p>

        {/* 2 Panel cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">

          {/* PUBLIC PANEL */}
          <Link href="/public/analytics" className="group">
            <div className="relative border border-[#FFD700]/20 rounded-2xl p-8 bg-[#FFD700]/[0.03] hover:bg-[#FFD700]/[0.07] hover:border-[#FFD700]/50 transition-all duration-300 text-left cursor-pointer overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-[#FFD700]/[0.04] to-transparent rounded-2xl" />
              <div className="relative z-10">
                <div className="text-3xl mb-4">🪙</div>
                <h2 className="text-xl font-black text-white mb-2 tracking-tight">Public Panel</h2>
                <h3 className="text-[#FFD700] text-sm font-mono mb-3">Gold Analytics Dashboard</h3>
                <p className="text-gray-500 text-sm leading-relaxed">Real-time gold price charts, batch registry, holder leaderboard, and vault proof of reserve.</p>
                <div className="mt-6 text-[#FFD700] text-sm font-mono group-hover:underline">
                  Open Analytics →
                </div>
              </div>
            </div>
          </Link>

          {/* ADMIN PANEL */}
          <Link href="/admin/login" className="group">
            <div className="relative border border-[#00E5FF]/20 rounded-2xl p-8 bg-[#00E5FF]/[0.02] hover:bg-[#00E5FF]/[0.06] hover:border-[#00E5FF]/50 transition-all duration-300 text-left cursor-pointer overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-[#00E5FF]/[0.03] to-transparent rounded-2xl" />
              <div className="relative z-10">
                <div className="text-3xl mb-4">⚙️</div>
                <h2 className="text-xl font-black text-white mb-2 tracking-tight">Admin Panel</h2>
                <h3 className="text-[#00E5FF] text-sm font-mono mb-3">Secure Management Terminal</h3>
                <p className="text-gray-500 text-sm leading-relaxed">Mint/burn PGOLD tokens, manage gold batches on-chain, and monitor all admin audit logs.</p>
                <div className="mt-6 text-[#00E5FF] text-sm font-mono group-hover:underline">
                  Admin Login →
                </div>
              </div>
            </div>
          </Link>

        </div>

        <p className="mt-12 text-gray-700 text-xs font-mono">
          admin@phenox.io · admin123 &nbsp;|&nbsp; Powered by Monad · Clerk · Solidity
        </p>
      </main>
    </div>
  );
}
