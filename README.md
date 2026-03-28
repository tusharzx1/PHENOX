# PHENOX 🌌 Cyberpunk Fraud Detection Terminal

PHENOX is a premium, 3rd-tier Security Terminal and RWA (Real World Asset) Gold management system built for the Monad ecosystem. It combines cutting-edge **Cyberpunk aesthetics** with a robust **Audit and Verification protocol**.

## 🚀 Vision
A high-end, obsidian-cyan interface that bridges the gap between traditional asset management and the decentralized future.

---

## 🏗️ Architecture
- **Frontend:** Next.js, React Three Fiber (3D), Tailwind, Framer Motion, Clerk.
- **Backend:** Node.js, Express, MongoDB, Clerk Auth.
- **Blockchain:** Monad Testnet (Smart Contracts in Solidity).

## 🛠️ Features
- **Face ID Verification:** Simulated biometric scanning with live video feed.
- **3D cosmic Background:** Immersive star-field environment.
- **Fraud Monitoring:** Interactive Glassmorphism credit card UI with neon failure alerts.
- **Audit Logs:** On-chain and off-chain audit trail for all admin actions.
- **Market Tracker:** Real-time (mocked) gold value analysis (USD/INR).

## 🔗 Monad Network Notes
- Docs: https://docs.monad.xyz/introduction/monad-for-developers
- Testnet RPC: `https://testnet-rpc.monad.xyz`
- Testnet Chain ID: `10143`
- Testnet Explorer: `https://testnet.monadvision.com`
- Testnet reset date: **December 16, 2025** (contracts must be redeployed after reset)

---

## 🚦 Getting Started

### 1. Requirements
- Node.js (v18+)
- MongoDB Atlas (Cloud)
- Clerk API Keys

### 2. Backend Initialization
```bash
cd backend
npm install
# Create .env from .env.example with your keys
node server.js
```

### 3. Frontend Initialization
```bash
cd frontend
npm install --legacy-peer-deps
# Create .env.local from .env.local.example with your keys
npm run dev
```

### 4. Smart Contracts
```bash
cd contracts
npm install
npx hardhat compile
# Deploy when ready
npx hardhat run scripts/deploy.js --network monadTestnet
```

### 5. Security Checklist Before Deployment
- Do not commit any `.env` files (only commit `*.env.example` templates).
- Set `ADMIN_AUTH_TOKEN` and keep `ALLOW_INSECURE_DEMO_AUTH=false`.
- Configure Clerk keys (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`) for authenticated admin flows.
- Set Monad contract + RPC env values in `backend/.env`.
- Remove dependency folders from git index if they were accidentally committed (for example `contracts/node_modules`).

---

## ⚡ Live Project Summary
The core PHENOX system is now fully implemented and ready for deployment. The **Cyberpunk Terminal** is optimized for high-performance visual fidelity, and the **Admin Dashboard** is ready for asset management.

> [!IMPORTANT]
> **Authentication:** Clerk is used for all secure routes. Ensure valid keys are present in both `.env` files to enable the Face Scan and Dashboard flows.
