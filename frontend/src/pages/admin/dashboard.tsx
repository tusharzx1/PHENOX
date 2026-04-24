import React from 'react';
import { useAuth, useUser } from '@/lib/auth';
import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  Package,
  History,
  LogOut,
  Activity,
  Layers,
  MapPin,
  ShieldCheck,
  Database,
  Plus,
  MoreVertical,
  Search,
  Zap,
  Cpu,
  File,
  UploadCloud,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

type AdminBatchRecord = {
  batchId: string;
  weight: number;
  purity: number;
  location: string;
  certification?: string;
  certificateVerification?: CertificateVerification | null;
  isPublic: boolean;
  timestamp?: string;
  onChain?: {
    status?: string;
    txHash?: string;
    error?: string;
  };
};

type CertificateVerification = {
  isValid: boolean;
  reason: string;
  extractedData: {
    serialNumber: string | null;
    grossWeight: number | null;
    purity: string | null;
    assayer: string | null;
    dateOfIssue: string | null;
  };
  model?: string;
  verifiedAt?: string;
  fileName?: string;
  mimeType?: string;
};

type VerificationStepStatus = 'pending' | 'active' | 'complete' | 'failed';

type VerificationStep = {
  key: string;
  label: string;
  description: string;
  status: VerificationStepStatus;
};

type GoldPriceSnapshot = {
  usd: number;
  inr: number;
  source?: string;
  quoteTimestamp?: string | null;
  lastUpdated?: string | null;
  isFallback?: boolean;
};

type MarketSummary = {
  stablecoinCapUsd: number;
  rwaCapUsd: number;
  lastUpdated: string;
};

const normalizePurityToKarat = (purity: string | null | undefined) => {
  const value = String(purity || '').trim().toLowerCase();
  if (!value) return 24;
  if (value.includes('24') || value.includes('999') || value.includes('99.99')) return 24;
  if (value.includes('22') || value.includes('91.6')) return 22;
  if (value.includes('18') || value.includes('75')) return 18;
  return 24;
};

export default function AdminDashboard() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { getToken } = useAuth();
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
  const [totalSupply, setTotalSupply] = useState('0');
  const [batches, setBatches] = useState<AdminBatchRecord[]>([]);
  const [goldPrice, setGoldPrice] = useState<GoldPriceSnapshot>({ usd: 0, inr: 0 });
  const [marketSummary, setMarketSummary] = useState<MarketSummary>({
    stablecoinCapUsd: 0,
    rwaCapUsd: 0,
    lastUpdated: '',
  });
  const [dataMode, setDataMode] = useState<'live' | 'fallback'>('fallback');
  const [status, setStatus] = useState('');
  const [newBatch, setNewBatch] = useState({
    weight: '',
    purity: 24,
    location: '',
    certification: '',
    isPublic: true,
  });
  const [certificateVerification, setCertificateVerification] = useState<CertificateVerification | null>(null);
  const [isVerifyingCertificate, setIsVerifyingCertificate] = useState(false);
  const [certificateInputKey, setCertificateInputKey] = useState(0);
  const [verificationStep, setVerificationStep] = useState<'select' | 'upload' | 'analyze' | 'ready' | 'failed'>('select');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [isDemo, setIsDemo] = useState(false);
  
  // Premium UI State
  const [activeTab, setActiveTab] = useState('inventory');
  const [showAddModal, setShowAddModal] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const userEthAccount = '0x236739E25E14E24b0f739625fEc2e0A01192C4F8';

  useEffect(() => {
    // Production state
    setIsDemo(false);
  }, []);

  useEffect(() => {
    if ((!isLoaded || !isSignedIn) && !isDemo) return;

    let intervalId: ReturnType<typeof setInterval> | null = null;

    const init = async () => {
      setIsLoading(true);
      setStatus(`Connected to backend sync mode via ${userEthAccount}`);
      try {
        if ((window as any).ethereum) {
          await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
        }
      } catch {}

      await refreshDashboardData();
      intervalId = setInterval(() => {
        void refreshDashboardData(true);
      }, 30000);
    };

    void init();

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isLoaded, isSignedIn, isDemo]);

  useEffect(() => {
    const supply = batches.reduce((acc, batch) => acc + Number(batch.weight || 0), 0);
    setTotalSupply(supply.toFixed(2));
  }, [batches]);

  const fetchBatches = async () => {
    try {
      const token = isDemo ? null : await getToken();
      const adminRes = await fetch(`${backendUrl}/api/blockchain/admin/records`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (adminRes.ok) {
        const adminData = await adminRes.json();
        setBatches(adminData.data || []);
        return;
      }
    } catch {
      // fall through to public records
    }

    try {
      const publicRes = await fetch(`${backendUrl}/api/blockchain/public/records`);
      const publicData = await publicRes.json();
      setBatches(publicData.data || []);
    } catch {
      setBatches([]);
    }
  };

  const fetchGoldPrice = async () => {
    try {
      const res = await fetch(`${backendUrl}/api/gold-price`);
      const data = await res.json();
      setGoldPrice(data);
      setDataMode(data?.isFallback ? 'fallback' : 'live');
    } catch {
      setGoldPrice({ usd: 64, inr: 5312, source: 'Static fallback', isFallback: true });
      setDataMode('fallback');
    }
  };

  const fetchMarketSummary = async () => {
    try {
      const [stablecoinsRes, marketRes] = await Promise.all([
        fetch(`${backendUrl}/api/dashboard/stablecoins`),
        fetch(`${backendUrl}/api/dashboard/market-overview`),
      ]);
      const stablecoinsData = await stablecoinsRes.json();
      const marketData = await marketRes.json();

      setMarketSummary({
        stablecoinCapUsd: Number(stablecoinsData?.summary?.totalMarketCapUsd || 0),
        rwaCapUsd: Number(marketData?.summary?.rwaCombinedMarketCapUsd || 0),
        lastUpdated: new Date().toLocaleTimeString(),
      });
    } catch {
      setMarketSummary((current) => ({
        ...current,
        lastUpdated: current.lastUpdated || new Date().toLocaleTimeString(),
      }));
    }
  };

  const refreshDashboardData = async (silent = false) => {
    if (!silent) {
      setStatus(`Connected to backend sync mode via ${userEthAccount}`);
    }

    await Promise.all([
      fetchBatches(),
      fetchGoldPrice(),
      fetchMarketSummary(),
      fetchLogs(),
    ]);
    setIsLoading(false);
  };

  const fetchLogs = async () => {
    try {
      const token = isDemo ? null : await getToken();
      const res = await fetch(`${backendUrl}/api/logs`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.data || []);
      }
    } catch {
      setLogs([]);
    }
  };

  const addBatch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!certificateVerification?.isValid) {
      setStatus('Upload and verify a certificate before adding a batch.');
      return;
    }

    setStatus('Submitting batch to backend and anchoring payload hash on blockchain...');

    const batchId = `BATCH-${Date.now()}`;
    try {
      const token = isDemo ? null : await getToken();
      const res = await fetch(`${backendUrl}/api/blockchain/admin/push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          batchId,
          weight: Number(newBatch.weight),
          purity: Number(newBatch.purity),
          location: newBatch.location,
          certification: newBatch.certification,
          certificateVerification,
          isPublic: newBatch.isPublic,
          metadataURI: newBatch.certification ? `ipfs://${newBatch.certification}` : '',
        }),
      });

      const payload = await res.json();
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.message || 'Failed to push batch');
      }

      const chainStatus = payload?.data?.onChain?.status || 'PENDING';
      const txHash = payload?.data?.onChain?.txHash;
      setStatus(`Batch ${batchId} saved. Chain status: ${chainStatus}${txHash ? ` | Tx: ${txHash}` : ''}`);

      setNewBatch({ weight: '', purity: 24, location: '', certification: '', isPublic: true });
      setCertificateVerification(null);
      setCertificateInputKey((value) => value + 1);
      setVerificationStep('select');
      void refreshDashboardData(true);
    } catch (err: any) {
      setStatus(`Batch submit failed: ${err?.message || 'unknown error'}`);
    }
  };

  const handleCertificateChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsVerifyingCertificate(true);
    setCertificateVerification(null);
    setVerificationStep('upload');
    setStatus(`Verifying certificate "${file.name}" with Gemini...`);

    try {
      const token = isDemo ? null : await getToken();
      const formData = new FormData();
      formData.append('certificate', file);
      setVerificationStep('analyze');

      const response = await fetch(`${backendUrl}/api/verify-certificate`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || 'Certificate verification failed.');
      }

      const verification: CertificateVerification = {
        isValid: Boolean(payload.isValid),
        reason: String(payload.reason || ''),
        extractedData: {
          serialNumber: payload?.extractedData?.serialNumber || null,
          grossWeight: typeof payload?.extractedData?.grossWeight === 'number'
            ? payload.extractedData.grossWeight
            : null,
          purity: payload?.extractedData?.purity || null,
          assayer: payload?.extractedData?.assayer || null,
          dateOfIssue: payload?.extractedData?.dateOfIssue || null,
        },
        model: payload?.model,
        verifiedAt: payload?.verifiedAt,
        fileName: payload?.fileName,
        mimeType: payload?.mimeType,
      };

      setCertificateVerification(verification);

      if (!verification.isValid) {
        event.target.value = '';
        setVerificationStep('failed');
        throw new Error(verification.reason || 'Certificate rejected by Gemini.');
      }

      setNewBatch((current) => ({
        ...current,
        weight: verification.extractedData.grossWeight !== null
          ? String(verification.extractedData.grossWeight)
          : current.weight,
        purity: normalizePurityToKarat(verification.extractedData.purity),
        certification: current.certification || verification.extractedData.serialNumber || '',
      }));

      setStatus(
        `Certificate verified. ${verification.extractedData.serialNumber ? `Serial ${verification.extractedData.serialNumber} extracted.` : 'Required fields extracted.'}`
      );
      setVerificationStep('ready');
    } catch (err: any) {
      setVerificationStep('failed');
      setStatus(`Certificate verification failed: ${err?.message || 'unknown error'}`);
    } finally {
      setIsVerifyingCertificate(false);
    }
  };

  const mintTokens = async () => {
    setStatus('Live minting is not wired yet. Connect a real admin token endpoint or contract signer to enable mint.');
  };

  const burnTokens = async () => {
    setStatus('Live burn is not wired yet. Connect a real admin token endpoint or contract signer to enable burn.');
  };

  const displayUser = isDemo ? `${userEthAccount} (DEMO MODE)` : user?.emailAddresses?.[0]?.emailAddress || 'Admin User';

  return (
    <div className="min-h-screen bg-[#050505] text-white flex font-sans selection:bg-[#00E5FF]/30">
      {/* Decorative Aura */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vh] bg-[#00E5FF] opacity-[0.02] blur-[150px] rounded-full pointer-events-none z-0" />

      {/* Sidebar */}
      <aside className="w-20 lg:w-64 border-r border-[#00E5FF]/20 flex flex-col glass-panel z-20 relative">
        <div className="p-6 flex items-center gap-3 border-b border-[#00E5FF]/10">
          <div className="w-10 h-10 rounded-lg bg-[#00E5FF]/10 flex items-center justify-center neon-glow-cyan">
            <Cpu className="text-[#00E5FF] w-6 h-6" />
          </div>
          <span className="hidden lg:inline font-black uppercase tracking-widest text-[#00E5FF] italic">PHENOX</span>
        </div>

        <nav className="flex-1 p-4 space-y-4">
          <NavItem icon={<Layers />} label="Inventory" active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} />
          <NavItem icon={<History />} label="Audit Logs" active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} />
          <NavItem icon={<TrendingUp />} label="Market" active={activeTab === 'market'} onClick={() => setActiveTab('market')} />
        </nav>

        <div className="p-4 border-t border-[#00E5FF]/10">
          <button
            onClick={() => {
              localStorage.removeItem('phenox_demo_auth');
              window.location.href = '/admin/login';
            }}
            className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-[#FF3C3C]/10 text-white/60 hover:text-[#FF3C3C] transition-all"
          >
            <LogOut className="w-6 h-6" />
            <span className="hidden lg:inline font-bold uppercase text-[10px] tracking-widest">Terminate Session</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative z-10">
        <header className="p-8 flex justify-between items-center border-b border-[#00E5FF]/10 glass-panel sticky top-0 backdrop-blur-xl z-30">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-[0.2em] italic text-glow">PHENOX Dashboard</h1>
            <p className="text-white/40 text-[10px] font-mono mt-1 uppercase tracking-widest flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#39FF14] animate-pulse"></span>
              Network: <span className="text-[#00E5FF]">PRODUCTION MESH</span>
              <span className="mx-2 opacity-20">|</span>
              Identity: <span className="text-[#00E5FF]">{displayUser}</span>
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-6 py-3 rounded-full bg-[#00E5FF] text-black font-black uppercase text-[10px] tracking-widest hover:scale-105 active:scale-95 transition-all neon-glow-cyan"
          >
            <Plus className="w-4 h-4" />
            Initialize Asset
          </button>
        </header>

        <div className="p-8 max-w-7xl mx-auto space-y-8 pb-20">
          {/* Status Message */}
          <AnimatePresence>
            {status && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="p-3 bg-white/5 border border-[#00E5FF]/20 rounded-xl flex items-center gap-3 text-[10px] font-mono text-[#00E5FF]/80 uppercase tracking-wider"
              >
                <Zap className="w-3 h-3 animate-pulse" />
                {status}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard label="Tokenized Supply" value={`${totalSupply}g`} icon={<ShieldCheck />} color="#00E5FF" subLabel="Live Ledger Weight" />
            <StatCard label="24K Gold (USD)" value={`$${goldPrice.usd.toFixed(2)}`} icon={<TrendingUp />} color="#00E5FF" subLabel={goldPrice.source || 'Spot Price'} />
            <StatCard label="Stablecoin Cap" value={`$${(marketSummary.stablecoinCapUsd / 1e9).toFixed(1)}B`} icon={<Activity />} color="#00E5FF" subLabel="Global Aggregate" />
            <StatCard label="RWA Context" value={`$${(marketSummary.rwaCapUsd / 1e9).toFixed(1)}B`} icon={<Database />} color="#00E5FF" subLabel="Tokenized RWA Sector" />
          </div>

          {/* Active Content Section */}
          <section className="rounded-3xl glass-panel border-[#00E5FF]/10 min-h-[500px] relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5"><Cpu className="w-48 h-48" /></div>

            {activeTab === 'inventory' && (
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-xl font-bold uppercase tracking-widest border-l-4 border-[#00E5FF] pl-4 italic">Asset Ledger</h2>
                    <p className="text-white/40 text-[10px] uppercase tracking-widest mt-1 ml-5">Verified On-Chain Records</p>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                    <input type="text" placeholder="QUERY LEDGER..." className="bg-white/5 border border-white/10 rounded-full py-2 pl-10 pr-4 text-[10px] font-mono focus:outline-none focus:border-[#00E5FF]/40 transition-all w-64" />
                  </div>
                </div>

                <div className="overflow-hidden border border-white/10 rounded-2xl">
                  <table className="w-full text-left font-mono text-xs">
                    <thead className="bg-[#00E5FF]/5 uppercase text-white/40">
                      <tr>
                        <th className="p-4">Batch UID</th>
                        <th className="p-4 text-center">Weight</th>
                        <th className="p-4 text-center">Purity</th>
                        <th className="p-4">Origin / Location</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 text-right">Value (USD)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 uppercase">
                      {batches.map((batch, i) => (
                        <tr key={batch.batchId || i} className="hover:bg-white/5 transition-colors group">
                          <td className="p-4">
                            <div className="font-bold text-[#00E5FF] group-hover:text-glow-sm transition-all">{batch.batchId}</div>
                            {batch.onChain?.txHash && (
                              <div className="text-[8px] text-white/20 truncate max-w-[120px] hover:text-[#00E5FF]/40 cursor-pointer">
                                TX: {batch.onChain.txHash}
                              </div>
                            )}
                          </td>
                          <td className="p-4 text-center font-bold">{batch.weight}g</td>
                          <td className="p-4 text-center">{batch.purity}K</td>
                          <td className="p-4">
                            <div className="flex items-center gap-2"><MapPin className="w-3 h-3 text-[#00E5FF]" />{batch.location}</div>
                          </td>
                          <td className="p-4 text-[10px]">
                            <span className={`px-2 py-0.5 rounded-full border ${
                              batch.onChain?.status === 'SUCCESS' ? 'border-[#39FF14]/30 text-[#39FF14] bg-[#39FF14]/5' : 
                              'border-amber-500/30 text-amber-500 bg-amber-500/5'
                            }`}>
                              {batch.onChain?.status || 'PENDING'}
                            </span>
                          </td>
                          <td className="p-4 text-right font-bold text-[#00E5FF]">
                            ${(Number(batch.weight) * goldPrice.usd).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                      {!isLoading && batches.length === 0 && (
                        <tr><td colSpan={6} className="p-32 text-center text-white/20 font-mono tracking-widest uppercase">No Ledger Entries Found</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'logs' && (
              <div className="p-8">
                <h2 className="text-xl font-bold uppercase tracking-widest border-l-4 border-amber-500 pl-4 italic mb-8">System Audit Trail</h2>
                <div className="space-y-4">
                  {logs.map((log, idx) => (
                    <div key={idx} className="flex gap-4 p-4 rounded-xl border border-white/5 bg-white/5 hover:border-white/10 transition-all items-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#00E5FF] shadow-[0_0_8px_#00E5FF]" />
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                        <div className="text-[9px] font-mono text-white/30">{new Date(log.timestamp).toLocaleString()}</div>
                        <div className="text-[10px] font-bold uppercase flex items-center gap-2 italic"><Zap className="w-3 h-3 text-[#00E5FF]" />{log.action}</div>
                        <div className="text-[10px] text-white/60 font-mono">{log.details}</div>
                        <div className="text-[9px] text-white/20 text-right font-mono tracking-tighter">NODE: {log.ipAddress}</div>
                      </div>
                    </div>
                  ))}
                  {logs.length === 0 && <div className="p-32 text-center text-white/20 font-mono tracking-widest uppercase">Audit Logs Empty</div>}
                </div>
              </div>
            )}

            {activeTab === 'market' && (
              <div className="p-12 flex flex-col items-center justify-center min-h-[400px] gap-8">
                <div className="w-32 h-32 rounded-full border-2 border-dashed border-[#00E5FF]/20 flex items-center justify-center relative">
                   <TrendingUp className="w-16 h-16 text-[#00E5FF] animate-pulse" />
                   <div className="absolute inset-0 border-t-2 border-[#00E5FF] rounded-full animate-spin-slow"></div>
                </div>
                <div className="text-center space-y-4">
                  <div className="space-y-1">
                    <div className="text-6xl font-black text-[#00E5FF] italic tracking-tighter text-glow-sm">${goldPrice.usd.toFixed(2)}<span className="text-xl text-white/20 ml-2">/g</span></div>
                    <div className="text-white/40 font-mono text-[10px] uppercase tracking-[0.3em]">Global 24K Spot Index (XAU/USD)</div>
                  </div>
                  <div className="pt-4 space-y-1">
                    <div className="text-3xl font-bold text-white/80 italic">₹{goldPrice.inr.toFixed(2)}<span className="text-sm text-white/20 ml-2">/g</span></div>
                    <div className="text-white/20 font-mono text-[10px] uppercase tracking-[0.2em]">Live 24K Retail Pricing (INR)</div>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Initialize Batch Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl"
          >
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-xl glass-panel p-8 rounded-3xl border-[#00E5FF]/20 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#00E5FF] to-transparent" />
              
              <div className="flex justify-between items-start mb-8">
                <h2 className="text-2xl font-black uppercase italic flex items-center gap-4 text-glow-sm">
                  <Plus className="text-[#00E5FF]" /> Initialize Ledger Entry
                </h2>
                <button onClick={() => setShowAddModal(false)} className="text-white/40 hover:text-white transition-colors cursor-pointer">
                  <Plus className="rotate-45 w-6 h-6" />
                </button>
              </div>

              <form onSubmit={addBatch} className="space-y-6">
                {/* Certificate analysis gate */}
                <div className="p-5 rounded-2xl border border-white/10 bg-white/5 space-y-4 relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] text-[#00E5FF] uppercase font-mono tracking-widest flex items-center gap-2 font-bold">
                      <ShieldCheck className="w-3 h-3" /> Compliance Verification Gate
                    </label>
                    {isVerifyingCertificate && <div className="animate-spin w-3 h-3 border-2 border-[#00E5FF]/20 border-t-[#00E5FF] rounded-full" />}
                  </div>
                  
                  <div className={`flex items-center gap-4 p-4 rounded-xl border border-dashed transition-all duration-500 ${certificateVerification?.isValid ? 'border-[#00E5FF] bg-[#00E5FF]/10' : 'border-white/20 hover:border-white/40'}`}>
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center transition-all ${certificateVerification?.isValid ? 'bg-[#00E5FF] text-black neon-glow-cyan' : 'bg-white/5 text-white/20'}`}>
                      {certificateVerification?.isValid ? <CheckCircle2 className="w-6 h-6" /> : <UploadCloud className="w-6 h-6" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-black uppercase truncate tracking-tight">
                        {isVerifyingCertificate ? 'Gemini AI Analyzing...' : certificateVerification?.isValid ? `${certificateVerification.extractedData.assayer || 'TRUSTED'} CERTIFIED` : 'No Certificate Detected'}
                      </div>
                      <div className="text-[9px] text-white/40 uppercase font-mono mt-0.5">
                        {isVerifyingCertificate ? 'Processing neural analysis...' : certificateVerification?.isValid ? 'Bar authenticity confirmed' : 'Upload LBMA/Official Assayer PDF/Image'}
                      </div>
                    </div>
                    <label className="cursor-pointer px-4 py-2 rounded-lg bg-[#00E5FF] text-black text-[10px] font-black uppercase hover:scale-105 active:scale-95 transition-all shadow-[0_0_15px_rgba(0,229,255,0.3)]">
                      Browse
                      <input type="file" className="hidden" accept=".pdf,image/*" onChange={handleCertificateChange} disabled={isVerifyingCertificate} />
                    </label>
                  </div>
                  
                  {!certificateVerification?.isValid && !isVerifyingCertificate && status && status.includes('failed') && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                      className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-[9px] text-red-300 uppercase leading-relaxed italic"
                    >
                      <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                      <span>{status}</span>
                    </motion.div>
                  )}

                  {certificateVerification?.isValid && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                      className="grid grid-cols-2 gap-y-2 gap-x-4 text-[9px] text-[#00E5FF]/60 font-mono uppercase bg-black/20 p-3 rounded-xl border border-[#00E5FF]/10"
                    >
                      <div className="flex justify-between"><span>Serial:</span> <span className="text-white">{certificateVerification.extractedData.serialNumber || 'N/A'}</span></div>
                      <div className="flex justify-between"><span>Weight:</span> <span className="text-white">{certificateVerification.extractedData.grossWeight}g</span></div>
                      <div className="flex justify-between"><span>Purity:</span> <span className="text-white">{certificateVerification.extractedData.purity}</span></div>
                      <div className="flex justify-between"><span>Assayer:</span> <span className="text-white truncate max-w-[60px]">{certificateVerification.extractedData.assayer}</span></div>
                    </motion.div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-1.5 focus-within:translate-x-1 transition-all">
                    <label className="text-[10px] text-white/30 uppercase font-mono pl-1 tracking-widest">Bar Net Weight (g)</label>
                    <input type="number" placeholder="000.00" value={newBatch.weight} disabled
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm focus:border-[#00E5FF]/40 outline-none text-[#00E5FF] font-bold opacity-80 cursor-not-allowed" />
                  </div>
                  <div className="space-y-1.5 focus-within:translate-x-1 transition-all">
                    <label className="text-[10px] text-white/30 uppercase font-mono pl-1 tracking-widest">Purity Standard</label>
                    <select value={newBatch.purity} disabled
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm focus:border-[#00E5FF]/40 outline-none opacity-80 cursor-not-allowed">
                      <option value={24}>24K (99.99%)</option>
                      <option value={22}>22K (91.67%)</option>
                      <option value={18}>18K (75.00%)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-white/30 uppercase font-mono pl-1 tracking-widest">Origin Node / Vault Location</label>
                  <input type="text" placeholder="SECURE VAULT IDENTIFIER" value={newBatch.location}
                    onChange={e => setNewBatch({ ...newBatch, location: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm focus:border-[#00E5FF]/40 outline-none transition-all" required />
                </div>

                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setShowAddModal(false)}
                    className="flex-1 py-3 rounded-xl border border-white/10 hover:bg-white/5 text-[10px] font-black uppercase tracking-widest transition-all">Abort</button>
                  <button type="submit" disabled={isVerifyingCertificate || !certificateVerification?.isValid}
                    className={`flex-1 px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${certificateVerification?.isValid && !isVerifyingCertificate ? 'bg-[#00E5FF] text-black neon-glow-cyan shadow-[0_0_20px_#00E5FF]' : 'bg-white/5 text-white/20 cursor-not-allowed'}`}>
                    {isVerifyingCertificate ? 'AI PROCESSING...' : 'Anchor To Monad'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const NavItem = ({ icon, label, active, onClick }: { icon: any; label: string; active: boolean; onClick: () => void }) => (
  <button onClick={onClick}
    className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all duration-300 relative group ${active ? 'bg-[#00E5FF]/10 text-[#00E5FF] neon-glow-cyan' : 'text-white/40 hover:text-white/60 hover:bg-white/5'}`}>
    {React.cloneElement(icon, { className: 'w-5 h-5' })}
    <span className="hidden lg:inline font-black uppercase text-[10px] tracking-[0.2em]">{label}</span>
    {active && <div className="absolute right-2 w-1.5 h-1.5 rounded-full bg-[#00E5FF] shadow-[0_0_8px_#00E5FF]"></div>}
  </button>
);

const StatCard = ({ label, value, icon, color, subLabel }: { label: string; value: string; icon: any; color: string; subLabel?: string }) => (
  <div className="glass-panel p-6 rounded-3xl border-[#00E5FF]/10 relative group hover:border-[#00E5FF]/30 transition-all cursor-crosshair">
    <div className="flex items-center justify-between mb-4">
      <div className="text-[10px] font-mono text-white/40 uppercase tracking-[0.2em] italic">{label}</div>
      <div className="p-2.5 rounded-xl bg-white/5 text-[#00E5FF] group-hover:neon-glow-cyan transition-all border border-white/5">
        {React.cloneElement(icon, { className: 'w-4 h-4' })}
      </div>
    </div>
    <div className="text-3xl font-black italic tracking-tighter text-glow-sm" style={{ color }}>{value}</div>
    {subLabel && <div className="text-[8px] font-mono text-white/20 uppercase mt-2 tracking-widest">{subLabel}</div>}
  </div>
);


