import React, { useState, useRef, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Camera, Shield, ShieldCheck, ShieldAlert, Cpu, Activity, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const FaceVerificationPortal = ({ onVerify }: { onVerify: (status: 'verified' | 'failed') => void }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [status, setStatus] = useState<'idle' | 'scanning' | 'verified' | 'failed'>('idle');
  const webcamRef = useRef<Webcam>(null);

  const startScan = () => {
    setIsScanning(true);
    setStatus('scanning');
    
    // Simulate high-end backend AI processing
    setTimeout(() => {
      const isLegit = Math.random() > 0.2; // 80% success for demo
      if (isLegit) {
        setStatus('verified');
        setTimeout(() => onVerify('verified'), 1500);
      } else {
        setStatus('failed');
        setTimeout(() => onVerify('failed'), 1500);
      }
      setIsScanning(false);
    }, 3000);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md p-1 rounded-2xl bg-gradient-to-br from-[#00E5FF] to-transparent"
      >
        <div className="bg-[#050505] rounded-2xl overflow-hidden glass-panel p-6 border-none">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Cpu className="text-[#00E5FF] w-6 h-6 animate-pulse" />
              <h2 className="text-xl font-bold tracking-widest text-[#00E5FF]">PHENOX OS</h2>
            </div>
            <div className="px-2 py-1 rounded border border-[#00E5FF]/30 text-[10px] text-[#00E5FF] uppercase tracking-tighter">
              Secured Endpoint
            </div>
          </div>

          <div className="relative aspect-video rounded-lg overflow-hidden border border-[#00E5FF]/20 bg-black mb-6">
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              className="w-full h-full object-cover grayscale opacity-60"
            />
            
            <AnimatePresence>
              {isScanning && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-10"
                >
                  <div className="scanning-line" />
                  <div className="absolute inset-0 bg-[#00E5FF]/5 animate-pulse" />
                  <div className="absolute top-2 left-2 flex items-center gap-2 text-[#00E5FF] text-[10px] font-mono">
                    <Activity className="w-3 h-3 animate-spin" />
                    ANALYZING BIOMETRICS...
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {status === 'verified' && (
              <div className="absolute inset-0 bg-[#00E5FF]/20 flex items-center justify-center">
                <ShieldCheck className="w-16 h-16 text-[#00E5FF] drop-shadow-[0_0_10px_#00E5FF]" />
              </div>
            )}
            
            {status === 'failed' && (
              <div className="absolute inset-0 bg-[#FF3C3C]/20 flex items-center justify-center">
                <ShieldAlert className="w-16 h-16 text-[#FF3C3C] drop-shadow-[0_0_10px_#FF3C3C]" />
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-4 p-3 rounded bg-white/5 border border-white/10">
              <User className="text-white/40 w-5 h-5" />
              <div className="flex-1">
                <div className="text-[10px] text-white/40 uppercase">Identity Probe</div>
                <div className="text-sm font-mono">{status === 'scanning' ? 'DETECTING...' : status === 'verified' ? 'ADMIN_VALIDATED' : 'WAITING...'}</div>
              </div>
            </div>

            {status === 'idle' && (
              <button
                onClick={startScan}
                className="w-full py-4 rounded-lg bg-transparent border border-[#00E5FF] text-[#00E5FF] font-bold uppercase tracking-[0.2em] hover:bg-[#00E5FF] hover:text-black transition-all duration-300 neon-glow-cyan"
              >
                Initiate Face Scan
              </button>
            )}

            {status === 'scanning' && (
              <div className="text-center py-4 text-[#00E5FF] font-mono animate-pulse">
                SCANNIG MICRO-EXPRESSIONS...
              </div>
            )}

            {status === 'verified' && (
              <div className="text-center py-4 text-[#00E5FF] font-bold uppercase tracking-widest bg-[#00E5FF]/10 rounded border border-[#00E5FF]">
                Access Granted
              </div>
            )}

            {status === 'failed' && (
              <div className="text-center py-4 text-[#FF3C3C] font-bold uppercase tracking-widest bg-[#FF3C3C]/10 rounded border border-[#FF3C3C] vibrate">
                Identity Mismatch
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default FaceVerificationPortal;
