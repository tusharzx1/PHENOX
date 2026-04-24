import { useAuth, useUser } from '@/lib/auth';
import { useEffect, useState } from 'react';

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
  const [goldPrice, setGoldPrice] = useState({ usd: 0, inr: 0 });
  const [status, setStatus] = useState('');
  const [newBatch, setNewBatch] = useState({ weight: '', purity: 24, location: '', certification: '', isPublic: true });
  const [certificateVerification, setCertificateVerification] = useState<CertificateVerification | null>(null);
  const [isVerifyingCertificate, setIsVerifyingCertificate] = useState(false);
  const [certificateInputKey, setCertificateInputKey] = useState(0);
  const [verificationStep, setVerificationStep] = useState<'select' | 'upload' | 'analyze' | 'ready' | 'failed'>('select');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');

  const [isDemo, setIsDemo] = useState(false);
  const userEthAccount = '0x236739E25E14E24b0f739625fEc2e0A01192C4F8';

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('phenox_demo_auth') === 'true') {
      setIsDemo(true);
    }
  }, []);

  useEffect(() => {
    if ((!isLoaded || !isSignedIn) && !isDemo) return;
    const init = async () => {
      setStatus(`Connected to backend sync mode via ${userEthAccount}`);
      try {
        if ((window as any).ethereum) {
           await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
        }
      } catch(e) {}
      
      fetchTotalSupply();
      fetchBatches();
      fetchGoldPrice();
    };
    init();
  }, [isLoaded, isSignedIn, isDemo]);

  useEffect(() => {
    const supply = batches.reduce((acc, batch) => acc + Number(batch.weight || 0), 0);
    setTotalSupply(supply.toFixed(2));
  }, [batches]);

  const fetchTotalSupply = async () => {
    const supply = batches.reduce((acc, batch) => acc + Number(batch.weight || 0), 0);
    setTotalSupply(supply.toFixed(2));
  };

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
      // fallback below
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
    } catch {
       setGoldPrice({ usd: 64, inr: 5312 });
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
      fetchBatches();
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
    setStatus('Minting tokens on Ledger...');
    setTimeout(() => {
      const supply = parseFloat(localStorage.getItem('mock_supply') || '50000.0');
      localStorage.setItem('mock_supply', (supply + parseFloat(amount)).toString());
      setStatus(`Minted ${amount} PGOLD to ${recipient || userEthAccount}`);
      fetchTotalSupply();
    }, 1200);
  };

  const burnTokens = async () => {
    setStatus('Burning tokens on Ledger...');
    setTimeout(() => {
      const supply = parseFloat(localStorage.getItem('mock_supply') || '50000.0');
      const newSupply = supply - parseFloat(amount);
      localStorage.setItem('mock_supply', newSupply > 0 ? newSupply.toString() : '0');
      setStatus(`Burned ${amount} PGOLD from ${recipient || userEthAccount}`);
      fetchTotalSupply();
    }, 1200);
  };

  if ((!isLoaded || !isSignedIn) && !isDemo) return <div className="p-4 bg-[#050505] min-h-screen text-white flex items-center justify-center font-mono">Loading Config...</div>;

  const displayUser = isDemo ? `${userEthAccount} (DEMO MODE)` : user?.emailAddresses[0]?.emailAddress;
  const verificationSteps: VerificationStep[] = [
    {
      key: 'select',
      label: 'Step 1',
      description: 'Select certificate file',
      status:
        verificationStep === 'select' ? 'active' :
        ['upload', 'analyze', 'ready', 'failed'].includes(verificationStep) ? 'complete' :
        'pending',
    },
    {
      key: 'upload',
      label: 'Step 2',
      description: 'Upload file to backend',
      status:
        verificationStep === 'upload' ? 'active' :
        ['analyze', 'ready'].includes(verificationStep) ? 'complete' :
        verificationStep === 'failed' ? 'failed' :
        'pending',
    },
    {
      key: 'analyze',
      label: 'Step 3',
      description: 'Gemini analyzes certificate',
      status:
        verificationStep === 'analyze' ? 'active' :
        verificationStep === 'ready' ? 'complete' :
        verificationStep === 'failed' ? 'failed' :
        'pending',
    },
    {
      key: 'ready',
      label: 'Step 4',
      description: 'Batch unlocked for submission',
      status:
        verificationStep === 'ready' ? 'complete' :
        verificationStep === 'failed' ? 'failed' :
        'pending',
    },
  ];

  const getStepClasses = (stepStatus: VerificationStepStatus) => {
    if (stepStatus === 'complete') return 'border-green-500/40 bg-green-500/10 text-green-300';
    if (stepStatus === 'active') return 'border-cyan-400/50 bg-cyan-500/10 text-cyan-200';
    if (stepStatus === 'failed') return 'border-red-500/40 bg-red-500/10 text-red-300';
    return 'border-white/10 bg-white/5 text-gray-400';
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 relative overflow-hidden">
      {/* Decorative Core */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vh] bg-[#00E5FF] opacity-[0.03] blur-[150px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10 glass-panel border border-[#00E5FF]/20 p-8 rounded-xl shadow-[0_0_20px_rgba(0,229,255,0.05)]">
        <h1 className="text-3xl font-bold mb-6 font-mono text-[#00E5FF] text-glow uppercase tracking-widest">&gt; PHENOX Admin Dashboard</h1>
        <p className="mb-4 text-sm text-gray-400 font-mono flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#39FF14] animate-pulse"></span>
          Logged in as {displayUser}
        </p>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-gray-800 p-4 rounded">
            <h3>Total Supply</h3>
            <p className="text-2xl">{totalSupply} PGOLD</p>
          </div>
          <div className="bg-gray-800 p-4 rounded">
            <h3>Gold Price (USD/g)</h3>
            <p className="text-2xl">${goldPrice.usd}</p>
          </div>
          <div className="bg-gray-800 p-4 rounded">
            <h3>Gold Price (INR/g)</h3>
            <p className="text-2xl">₹{goldPrice.inr}</p>
          </div>
        </div>

        {/* Gold Batch Management */}
        <div className="bg-gray-800 p-6 rounded mb-8">
          <h2 className="text-xl font-bold mb-4">Add New Gold Batch</h2>
          <form onSubmit={addBatch} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 rounded border border-cyan-500/30 bg-black/20 p-4">
              <label className="mb-2 block text-sm text-cyan-200">Certificate File</label>
              <input
                key={certificateInputKey}
                type="file"
                accept=".pdf,image/png,image/jpeg,image/jpg,image/webp"
                onChange={handleCertificateChange}
                className="w-full rounded border border-white/10 bg-gray-700 p-2"
                required
              />
              <p className="mt-2 text-xs text-gray-400">
                Gemini must approve the certificate before this batch can be submitted.
              </p>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
                {verificationSteps.map((step) => (
                  <div key={step.key} className={`rounded border p-3 text-xs ${getStepClasses(step.status)}`}>
                    <p className="font-semibold uppercase tracking-wide">{step.label}</p>
                    <p className="mt-1">{step.description}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-sm">
                {isVerifyingCertificate && <p className="text-cyan-300">Verification in progress...</p>}
                {!isVerifyingCertificate && certificateVerification?.isValid && (
                  <p className="text-green-400">
                    Verified via {certificateVerification.model || 'Gemini'}.
                  </p>
                )}
                {!isVerifyingCertificate && !certificateVerification?.isValid && certificateVerification && (
                  <p className="text-red-400">{certificateVerification.reason}</p>
                )}
              </div>
              {certificateVerification?.isValid && (
                <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-gray-300 md:grid-cols-2">
                  <p>Serial: {certificateVerification.extractedData.serialNumber || 'n/a'}</p>
                  <p>Weight: {certificateVerification.extractedData.grossWeight ?? 'n/a'} g</p>
                  <p>Purity: {certificateVerification.extractedData.purity || 'n/a'}</p>
                  <p>Assayer: {certificateVerification.extractedData.assayer || 'n/a'}</p>
                  <p>Date: {certificateVerification.extractedData.dateOfIssue || 'n/a'}</p>
                  <p>File: {certificateVerification.fileName || 'n/a'}</p>
                </div>
              )}
            </div>
            <input
              type="number"
              placeholder="Weight (grams)"
              value={newBatch.weight}
              onChange={e => setNewBatch({...newBatch, weight: e.target.value})}
              className="bg-gray-700 p-2 rounded"
              required
            />
            <select
              value={newBatch.purity}
              onChange={e => setNewBatch({...newBatch, purity: parseInt(e.target.value)})}
              className="bg-gray-700 p-2 rounded"
            >
              <option value={24}>24K</option>
              <option value={22}>22K</option>
              <option value={18}>18K</option>
            </select>
            <input
              type="text"
              placeholder="Location"
              value={newBatch.location}
              onChange={e => setNewBatch({...newBatch, location: e.target.value})}
              className="bg-gray-700 p-2 rounded"
              required
            />
            <input
              type="text"
              placeholder="Certificate reference / CID"
              value={newBatch.certification}
              onChange={e => setNewBatch({...newBatch, certification: e.target.value})}
              className="bg-gray-700 p-2 rounded"
            />
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={newBatch.isPublic}
                onChange={e => setNewBatch({...newBatch, isPublic: e.target.checked})}
                className="mr-2"
              />
              Public
            </label>
            <button
              type="submit"
              disabled={isVerifyingCertificate || !certificateVerification?.isValid}
              className="rounded bg-blue-600 p-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Add Batch
            </button>
          </form>
        </div>

        {/* Batch List */}
        <div className="bg-gray-800 p-6 rounded mb-8">
          <h2 className="text-xl font-bold mb-4">Gold Batches</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left p-2">Batch ID</th>
                  <th>Weight (g)</th>
                  <th>Purity</th>
                  <th>Location</th>
                  <th>Public</th>
                  <th>Chain Status</th>
                  <th>Value (USD)</th>
                  <th>Value (INR)</th>
                  <th>Tokens</th>
                </tr>
              </thead>
              <tbody>
                {batches.map(batch => (
                  <tr key={batch.batchId} className="border-b border-gray-700">
                    <td className="p-2">{batch.batchId}</td>
                    <td>{Number(batch.weight).toString()}</td>
                    <td>{batch.purity}K</td>
                    <td>{batch.location}</td>
                    <td>{batch.isPublic ? 'Yes' : 'No'}</td>
                    <td>{batch.onChain?.status || 'PENDING'}</td>
                    <td>${(Number(batch.weight) * goldPrice.usd).toFixed(2)}</td>
                    <td>₹{(Number(batch.weight) * goldPrice.inr).toFixed(2)}</td>
                    <td>{Number(batch.weight).toString()} PGOLD</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Token Operations */}
        <div className="bg-gray-800 p-6 rounded">
          <h2 className="text-xl font-bold mb-4">Mint / Burn Tokens</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <input
                type="text"
                placeholder="Recipient Address"
                value={recipient}
                onChange={e => setRecipient(e.target.value)}
                className="w-full bg-gray-700 p-2 rounded mb-2"
              />
              <input
                type="text"
                placeholder="Amount (PGOLD)"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full bg-gray-700 p-2 rounded mb-2"
              />
              <div className="flex gap-2">
                <button onClick={mintTokens} className="bg-green-600 p-2 rounded flex-1">Mint</button>
                <button onClick={burnTokens} className="bg-red-600 p-2 rounded flex-1">Burn</button>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-4 text-yellow-500">{status}</p>
      </div>
    </div>
  );
}
