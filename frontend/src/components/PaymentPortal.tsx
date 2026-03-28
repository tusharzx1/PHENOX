import React, { useState } from 'react';
import { CreditCard, Zap, MapPin, Loader2, CheckCircle2, AlertTriangle, Cpu } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const CreditCardInterface = ({ onProcess }: { onProcess: (status: 'legitimate' | 'fraudulent') => void }) => {
  const [formData, setFormData] = useState({ number: '', name: '', cvv: '', location: '' });
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    // Simulate fraud detection AI analysis
    setTimeout(() => {
      const isLegit = Math.random() > 0.3; // 70% success for demo
      onProcess(isLegit ? 'legitimate' : 'fraudulent');
      setIsProcessing(false);
    }, 2500);
  };

  return (
    <div className="w-full max-w-lg">
      <div className="relative p-6 rounded-3xl glass-panel neon-glow-cyan border-[#00E5FF]/20 overflow-hidden">
        {/* Animated Background Pulse */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#00E5FF]/5 to-transparent animate-pulse" />
        
        <div className="flex justify-between items-start mb-8 relative z-10">
          <div className="flex items-center gap-2">
            <Cpu className="text-[#00E5FF] w-8 h-8 opacity-80" />
            <div className="text-[10px] font-mono text-[#00E5FF]/60 uppercase tracking-widest">Secure Ledger</div>
          </div>
          <Zap className="text-[#00E5FF]/40 w-6 h-6" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
          <div className="space-y-2">
            <label className="text-[10px] text-white/50 uppercase tracking-widest font-mono ml-1">Universal ID Number</label>
            <input
              type="text"
              placeholder="0000 0000 0000 0000"
              maxLength={19}
              value={formData.number}
              onChange={(e) => setFormData({ ...formData, number: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl p-4 font-mono text-lg tracking-widest focus:border-[#00E5FF]/50 focus:outline-none focus:bg-white/10 transition-all"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] text-white/50 uppercase tracking-widest font-mono ml-1">Access Location</label>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#00E5FF]/50" />
                <input
                  type="text"
                  placeholder="GEO_COORD"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-4 pl-12 font-mono text-xs focus:border-[#00E5FF]/50 focus:outline-none transition-all"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] text-white/50 uppercase tracking-widest font-mono ml-1">Security Key</label>
              <input
                type="password"
                placeholder="***"
                maxLength={3}
                value={formData.cvv}
                onChange={(e) => setFormData({ ...formData, cvv: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 font-mono text-center focus:border-[#00E5FF]/50 focus:outline-none transition-all"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isProcessing}
            className="w-full py-4 rounded-xl bg-[#00E5FF] text-black font-black uppercase tracking-[0.3em] text-sm hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Validating...
              </>
            ) : (
              'Verify & Execute'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

const PaymentPortal = ({ onComplete }: { onComplete: () => void }) => {
  const [flow, setFlow] = useState<'selection' | 'credit' | 'status'>('selection');
  const [status, setStatus] = useState<'legitimate' | 'fraudulent' | null>(null);

  const handleStatus = (res: 'legitimate' | 'fraudulent') => {
    setStatus(res);
    setFlow('status');
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <AnimatePresence mode="wait">
        {flow === 'selection' && (
          <motion.div
            key="selection"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="w-full max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            <div 
              onClick={() => setFlow('credit')}
              className="p-8 rounded-3xl glass-panel border-[#00E5FF]/20 cursor-pointer transition-all hover:bg-white/10 hover:neon-glow-cyan group"
            >
              <CreditCard className="w-12 h-12 text-[#00E5FF] mb-6 group-hover:scale-110 transition-transform" />
              <h3 className="text-2xl font-black uppercase tracking-widest mb-2 italic text-[#00E5FF]">Standard Protocol</h3>
              <p className="text-white/40 text-sm font-mono leading-relaxed">
                Legacy fiat relay with biometric encryption and real-time fraud monitoring.
              </p>
            </div>

            <div 
              className="p-8 rounded-3xl glass-panel border-white/10 opacity-60 cursor-not-allowed group relative overflow-hidden"
            >
               <div className="absolute top-4 right-4 text-[10px] font-mono text-[#00E5FF]">SOON™</div>
              <Zap className="w-12 h-12 text-white/40 mb-6" />
              <h3 className="text-2xl font-black uppercase tracking-widest mb-2 italic">Crypto UPI</h3>
              <p className="text-white/40 text-sm font-mono leading-relaxed">
                On-chain distributed ledger interface with zk-proof verification (Restricted).
              </p>
            </div>
          </motion.div>
        )}

        {flow === 'credit' && (
          <motion.div
            key="credit"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="w-full flex justify-center"
          >
            <CreditCardInterface onProcess={handleStatus} />
          </motion.div>
        )}

        {flow === 'status' && status && (
          <motion.div
            key="status"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`w-full max-w-md p-10 rounded-3xl text-center glass-panel border-2 ${
              status === 'legitimate' ? 'border-[#00E5FF] neon-glow-cyan' : 'border-[#FF3C3C] neon-glow-red vibrate'
            }`}
          >
            {status === 'legitimate' ? (
              <>
                <CheckCircle2 className="w-20 h-20 text-[#00E5FF] mx-auto mb-6 drop-shadow-[0_0_10px_#00E5FF]" />
                <h2 className="text-3xl font-black uppercase text-[#00E5FF] mb-4">Identity Cleared</h2>
                <p className="text-white/60 font-mono mb-8">Access granted. Redirecting to PHENOX Dashboard...</p>
                <button
                  onClick={onComplete}
                  className="px-8 py-3 rounded-full bg-white/10 border border-[#00E5FF]/40 text-[#00E5FF] font-black uppercase text-xs tracking-[0.2em] hover:bg-[#00E5FF] hover:text-black transition-all"
                >
                  Enter Dashboard
                </button>
              </>
            ) : (
              <>
                <AlertTriangle className="w-20 h-20 text-[#FF3C3C] mx-auto mb-6 drop-shadow-[0_0_10px_#FF3C3C]" />
                <h2 className="text-3xl font-black uppercase text-[#FF3C3C] mb-4">Fraud Detected</h2>
                <p className="text-white/60 font-mono mb-8 italic">Unauthorized access attempt logged. System Lockdown initiated.</p>
                <button
                  onClick={() => setFlow('selection')}
                  className="px-8 py-3 rounded-full bg-white/5 border border-[#FF3C3C]/40 text-[#FF3C3C] font-black uppercase text-xs tracking-[0.2em] hover:bg-[#FF3C3C] hover:text-white transition-all"
                >
                  Retry Protocol
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PaymentPortal;
