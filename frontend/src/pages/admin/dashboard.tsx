import { useUser } from '@clerk/nextjs';
import { useEffect, useState } from 'react';

type AdminBatchRecord = {
  batchId: string;
  weight: number;
  purity: number;
  location: string;
  certification?: string;
  isPublic: boolean;
  timestamp?: string;
  onChain?: {
    status?: string;
    txHash?: string;
    error?: string;
  };
};

export default function AdminDashboard() {
  const { isLoaded, isSignedIn, user } = useUser();
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
  const [totalSupply, setTotalSupply] = useState('0');
  const [batches, setBatches] = useState<AdminBatchRecord[]>([]);
  const [goldPrice, setGoldPrice] = useState({ usd: 0, inr: 0 });
  const [status, setStatus] = useState('');
  const [newBatch, setNewBatch] = useState({ weight: '', purity: 24, location: '', certification: '', isPublic: true });
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
      const adminRes = await fetch(`${backendUrl}/api/blockchain/admin/records`);
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
    setStatus('Submitting batch to backend and anchoring payload hash on blockchain...');

    const batchId = `BATCH-${Date.now()}`;
    try {
      const res = await fetch(`${backendUrl}/api/blockchain/admin/push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-email': user?.emailAddresses?.[0]?.emailAddress || 'demo@phenox.com',
        },
        body: JSON.stringify({
          batchId,
          weight: Number(newBatch.weight),
          purity: Number(newBatch.purity),
          location: newBatch.location,
          certification: newBatch.certification,
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
      fetchBatches();
    } catch (err: any) {
      setStatus(`Batch submit failed: ${err?.message || 'unknown error'}`);
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
              placeholder="Certification (optional)"
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
            <button type="submit" className="bg-blue-600 p-2 rounded">Add Batch</button>
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
