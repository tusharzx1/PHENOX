import React, { useState, useEffect } from 'react';
import axios from 'axios';
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
import { motion, AnimatePresence } from 'framer-motion';

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001/api/v1';

const AdminDashboard = ({ isDemo = false }: { isDemo?: boolean }) => {
  const [batches, setBatches] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [goldPrice, setGoldPrice] = useState({ usd: 0, inr: 0 });
  const [activeTab, setActiveTab] = useState('inventory');
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({ batchId: '', weight: '', purity: 24, location: '', certification: '', isPublic: true });
  
  // Certificate verification states
  const [isVerifying, setIsVerifying] = useState(false);
  const [certValid, setCertValid] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [verificationFeedback, setVerificationFeedback] = useState('');

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchPrice, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [batchRes, priceRes] = await Promise.all([
        axios.get(`${API_BASE}/batches`),
        axios.get(`${API_BASE}/gold-price`)
      ]);
      setBatches(batchRes.data.data || batchRes.data || []);
      setGoldPrice(priceRes.data.data || priceRes.data);
      // Fetch logs separately - may fail in mock mode
      try {
        const logRes = await axios.get(`${API_BASE}/logs`);
        setLogs(logRes.data.data || logRes.data || []);
      } catch {
        setLogs([]);
      }
    } catch (err) {
      console.error('Data Fetch Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPrice = async () => {
    try {
      const res = await axios.get(`${API_BASE}/gold-price`);
      setGoldPrice(res.data.data || res.data);
    } catch {}
  };

  const handleAddBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!certValid) {
      alert('A valid certificate must be verified before adding to the ledger.');
      return;
    }
    try {
      await axios.post(`${API_BASE}/batches`, formData);
      setShowAddModal(false);
      fetchData();
      resetForm();
    } catch (err) {
      alert('Submission failed. Ensure backend is running.');
    }
  };

  const handleCertificateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsVerifying(true);
    setCertValid(false);
    setVerificationFeedback('ANALYZING DOCUMENT...');

    const uploadData = new FormData();
    uploadData.append('certificate', file);

    try {
      // Note: Endpoint is on /api, not /api/v1
      const response = await axios.post(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'}/api/verify-certificate`, uploadData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const data = response.data;
      if (data.isValid) {
        setCertValid(true);
        setExtractedData(data.extractedData);
        setVerificationFeedback(`VERIFIED: ${data.extractedData.assayer || 'ASSAYER'} CERTIFIED`);
        
        // Auto-populate form
        setFormData(prev => ({
          ...prev,
          batchId: data.extractedData.serialNumber || prev.batchId,
          weight: data.extractedData.grossWeight ? String(data.extractedData.grossWeight) : prev.weight,
          purity: data.extractedData.purity && data.extractedData.purity.includes('24') ? 24 : 
                  data.extractedData.purity && data.extractedData.purity.includes('22') ? 22 : prev.purity
        }));
      } else {
        setCertValid(false);
        setVerificationFeedback(`REJECTED: ${data.reason}`);
      }
    } catch (err: any) {
      console.error('Verification Error:', err);
      setCertValid(false);
      setVerificationFeedback(err.response?.data?.message || 'VERIFICATION SERVICE UNAVAILABLE');
    } finally {
      setIsVerifying(false);
    }
  };

  const resetForm = () => {
    setFormData({ batchId: '', weight: '', purity: 24, location: '', certification: '', isPublic: true });
    setCertValid(false);
    setExtractedData(null);
    setVerificationFeedback('');
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex">
      {/* Sidebar */}
      <aside className="w-20 lg:w-64 border-r border-[#00E5FF]/20 flex flex-col glass-panel">
        <div className="p-6 flex items-center gap-3 border-b border-[#00E5FF]/10">
          <div className="w-10 h-10 rounded-lg bg-[#00E5FF]/10 flex items-center justify-center neon-glow-cyan">
            <Cpu className="text-[#00E5FF] w-6 h-6" />
          </div>
          <span className="hidden lg:inline font-black uppercase tracking-widest text-[#00E5FF]">PHENOX</span>
        </div>

        <nav className="flex-1 p-4 space-y-4">
          <NavItem icon={<Layers />} label="Inventory" active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} />
          <NavItem icon={<History />} label="Audit Logs" active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} />
          <NavItem icon={<TrendingUp />} label="Market" active={activeTab === 'market'} onClick={() => setActiveTab('market')} />
        </nav>

        <div className="p-4 border-t border-[#00E5FF]/10">
          <button
            onClick={() => window.location.reload()}
            className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-[#FF3C3C]/10 text-white/60 hover:text-[#FF3C3C] transition-all"
          >
            <LogOut className="w-6 h-6" />
            <span className="hidden lg:inline font-bold uppercase text-xs">Shutdown</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <header className="p-8 flex justify-between items-center border-b border-[#00E5FF]/10 glass-panel">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-[0.2em] italic">PHENOX Dashboard</h1>
            <p className="text-white/40 text-[10px] font-mono mt-1 uppercase tracking-widest">
              Mode: <span className="text-[#00E5FF]">{isDemo ? 'DEMO_MOCK' : 'LIVE'}</span>
              {isDemo && <span className="ml-2 px-2 py-0.5 rounded bg-amber-500/20 text-amber-500 text-[8px] border border-amber-500/20">DEMO_MODE</span>}
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-6 py-3 rounded-full bg-[#00E5FF] text-black font-black uppercase text-xs tracking-widest hover:scale-105 transition-all neon-glow-cyan"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden md:inline">Initialize Batch</span>
          </button>
        </header>

        <div className="p-8 max-w-7xl mx-auto space-y-8">
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard label="Live Supply" value={batches.reduce((acc, b) => acc + (b.weight || 0), 0) + 'g'} icon={<ShieldCheck />} color="#00E5FF" />
            <StatCard label="PGOLD Value (USD)" value={'$' + (goldPrice.usd || 0).toFixed(2)} icon={<TrendingUp />} color="#00E5FF" />
            <StatCard label="Batches Tracked" value={String(batches.length)} icon={<Activity />} color="#00E5FF" />
          </div>

          {/* Active Content */}
          <section className="rounded-3xl glass-panel border-[#00E5FF]/10 min-h-[500px] relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10"><Database className="w-32 h-32" /></div>

            {activeTab === 'inventory' && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-xl font-bold uppercase tracking-widest border-l-4 border-[#00E5FF] pl-4 italic">Asset Inventory</h2>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                    <input type="text" placeholder="QUERY LEDGER..." className="bg-white/5 border border-white/10 rounded-full py-2 pl-10 pr-4 text-[10px] font-mono focus:outline-none focus:border-[#00E5FF]/40 transition-all" />
                  </div>
                </div>
                <div className="overflow-hidden border border-white/10 rounded-2xl">
                  <table className="w-full text-left font-mono text-xs">
                    <thead className="bg-[#00E5FF]/5 uppercase text-white/40">
                      <tr>
                        <th className="p-4">Batch UID</th>
                        <th className="p-4 text-center">Weight</th>
                        <th className="p-4 text-center">Purity</th>
                        <th className="p-4">Location</th>
                        <th className="p-4 text-right">Value (USD)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 uppercase">
                      {batches.map((batch, i) => (
                        <tr key={batch.batchId || i} className="hover:bg-white/5 transition-colors">
                          <td className="p-4 font-bold text-[#00E5FF]">{batch.batchId}</td>
                          <td className="p-4 text-center">{batch.weight}g</td>
                          <td className="p-4 text-center">{batch.purity}K</td>
                          <td className="p-4 flex items-center gap-2"><MapPin className="w-3 h-3 text-[#00E5FF]" />{batch.location}</td>
                          <td className="p-4 text-right">${((batch.weight || 0) * (goldPrice.usd || 0)).toFixed(2)}</td>
                        </tr>
                      ))}
                      {!isLoading && batches.length === 0 && (
                        <tr><td colSpan={5} className="p-20 text-center text-white/20">NO BATCHES DETECTED IN LOCAL LEDGER</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'logs' && (
              <div className="p-6">
                <h2 className="text-xl font-bold uppercase tracking-widest border-l-4 border-[#FF3C3C] pl-4 italic mb-8">Security Audit Trail</h2>
                <div className="space-y-4">
                  {logs.map((log, idx) => (
                    <div key={idx} className="flex gap-4 p-4 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 transition-all items-center">
                      <div className="w-2 h-2 rounded-full bg-[#00E5FF] animate-pulse" />
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                        <div className="text-[10px] font-mono text-white/40">{new Date(log.timestamp).toLocaleString()}</div>
                        <div className="text-xs font-bold uppercase flex items-center gap-2"><Zap className="w-3 h-3 text-[#00E5FF]" />{log.action}</div>
                        <div className="text-[10px] text-white/60 truncate">{log.details}</div>
                        <div className="text-[10px] text-white/30 text-right font-mono">Node: {log.ipAddress}</div>
                      </div>
                    </div>
                  ))}
                  {logs.length === 0 && <div className="p-20 text-center text-white/20 font-mono">NO AUDIT EVENTS LOGGED</div>}
                </div>
              </div>
            )}

            {activeTab === 'market' && (
              <div className="p-6 flex flex-col items-center justify-center min-h-[400px] gap-6">
                <TrendingUp className="w-16 h-16 text-[#00E5FF]/40" />
                <div className="text-center">
                  <div className="text-4xl font-black text-[#00E5FF]">${(goldPrice.usd || 0).toFixed(2)}<span className="text-lg text-white/40">/g</span></div>
                  <div className="text-white/40 font-mono text-xs mt-2">LIVE GOLD PRICE (USD)</div>
                  <div className="text-2xl font-bold mt-4">₹{(goldPrice.inr || 0).toFixed(2)}<span className="text-sm text-white/40">/g</span></div>
                  <div className="text-white/40 font-mono text-xs mt-1">INR EQUIVALENT</div>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Add Batch Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          >
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
              className="w-full max-w-lg glass-panel p-8 rounded-3xl border-[#00E5FF]/20 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#00E5FF] to-transparent" />
              <h2 className="text-2xl font-black uppercase italic mb-8 flex items-center gap-4">
                <Plus className="text-[#00E5FF]" /> Initialize Ledger Record
              </h2>
              <form onSubmit={handleAddBatch} className="space-y-6">
                {/* Certificate analysis gate */}
                <div className="p-4 rounded-2xl border border-white/10 bg-white/5 space-y-3 relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] text-[#00E5FF] uppercase font-mono tracking-widest flex items-center gap-2">
                      <ShieldCheck className="w-3 h-3" /> Compliance Verification
                    </label>
                    {isVerifying && <div className="animate-spin w-3 h-3 border-2 border-[#00E5FF]/20 border-t-[#00E5FF] rounded-full" />}
                  </div>
                  
                  <div className={`flex items-center gap-4 p-3 rounded-xl border border-dashed transition-all ${certValid ? 'border-[#00E5FF]/40 bg-[#00E5FF]/5' : 'border-white/10 hover:border-white/20'}`}>
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${certValid ? 'bg-[#00E5FF]/20 text-[#00E5FF]' : 'bg-white/5 text-white/20'}`}>
                      {certValid ? <CheckCircle2 className="w-5 h-5 shadow-[0_0_10px_rgba(0,229,255,0.4)]" /> : <UploadCloud className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-bold uppercase truncate">
                        {verificationFeedback || 'Upload Assayer Certificate'}
                      </div>
                      <div className="text-[8px] text-white/40 uppercase font-mono mt-0.5">
                        {isVerifying ? 'Scanning with Gemini AI...' : certValid ? 'Verification Succeeded' : 'PDF, JPG or PNG (MAX 20MB)'}
                      </div>
                    </div>
                    <label className="cursor-pointer px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[9px] font-bold uppercase border border-white/10 transition-all">
                      Browse
                      <input type="file" className="hidden" accept="image/*,application/pdf" onChange={handleCertificateUpload} disabled={isVerifying} />
                    </label>
                  </div>
                  
                  {!certValid && !isVerifying && verificationFeedback && verificationFeedback.includes('REJECTED') && (
                    <div className="flex items-start gap-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-[8px] text-red-400 uppercase leading-relaxed">
                      <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                      <span>{verificationFeedback}</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] text-white/40 uppercase font-mono pl-1">Batch Identifier</label>
                    <input type="text" placeholder="B-..." value={formData.batchId}
                      onChange={e => setFormData({ ...formData, batchId: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm focus:border-[#00E5FF]/40 outline-none" required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-white/40 uppercase font-mono pl-1">Weight (Grams)</label>
                    <input type="number" placeholder="0.00" value={formData.weight}
                      onChange={e => setFormData({ ...formData, weight: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm focus:border-[#00E5FF]/40 outline-none" required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] text-white/40 uppercase font-mono pl-1">Purity (Karat)</label>
                    <select value={formData.purity} onChange={e => setFormData({ ...formData, purity: parseInt(e.target.value) })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm focus:border-[#00E5FF]/40 outline-none">
                      <option value={24}>24K</option>
                      <option value={22}>22K</option>
                      <option value={18}>18K</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-white/40 uppercase font-mono pl-1">Origin Node</label>
                    <input type="text" placeholder="LOCATION" value={formData.location}
                      onChange={e => setFormData({ ...formData, location: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm focus:border-[#00E5FF]/40 outline-none" required />
                  </div>
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setShowAddModal(false)}
                    className="flex-1 py-3 rounded-xl border border-white/10 hover:bg-white/5 text-xs font-bold uppercase">Abort</button>
                  <button type="submit" disabled={!certValid || isVerifying}
                    className={`flex-1 px-8 py-3 rounded-xl font-black uppercase text-xs transition-all ${certValid && !isVerifying ? 'bg-[#00E5FF] text-black neon-glow-cyan' : 'bg-white/5 text-white/20 cursor-not-allowed'}`}>
                    {isVerifying ? 'Verifying...' : 'Write To Ledger'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const NavItem = ({ icon, label, active, onClick }: { icon: any; label: string; active: boolean; onClick: () => void }) => (
  <button onClick={onClick}
    className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all duration-300 ${active ? 'bg-[#00E5FF]/10 text-[#00E5FF] neon-glow-cyan' : 'text-white/40 hover:text-white/60 hover:bg-white/5'}`}>
    {React.cloneElement(icon, { className: 'w-6 h-6' })}
    <span className="hidden lg:inline font-bold uppercase text-[10px] tracking-widest">{label}</span>
  </button>
);

const StatCard = ({ label, value, icon, color }: { label: string; value: string; icon: any; color: string }) => (
  <div className="glass-panel p-6 rounded-3xl border-[#00E5FF]/10 relative group hover:border-[#00E5FF]/30 transition-all">
    <div className="flex items-center justify-between mb-4">
      <div className="text-[10px] font-mono text-white/40 uppercase tracking-widest">{label}</div>
      <div className="p-2 rounded-lg bg-white/5 text-[#00E5FF] group-hover:neon-glow-cyan transition-all">
        {React.cloneElement(icon, { className: 'w-4 h-4' })}
      </div>
    </div>
    <div className="text-3xl font-black italic tracking-tighter" style={{ color }}>{value}</div>
  </div>
);

export default AdminDashboard;
