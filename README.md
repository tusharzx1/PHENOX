# PHENOX

PHENOX is a cyberpunk-style gold RWA dashboard and admin terminal built with a Next.js frontend, an Express backend, and Monad-oriented contract flows.

This repo currently includes:

- a public analytics dashboard
- an admin dashboard with local demo auth
- backend dashboard APIs with fallback/mock data for demo reliability
- Firebase Hosting support for the exported frontend

## Stack

- Frontend: Next.js 14, React 18, Tailwind CSS, Framer Motion, Three.js
- Backend: Node.js, Express, Axios, PostgreSQL client, Ethers
- Auth: local demo auth shim in the frontend
- Hosting: Firebase Hosting for the static frontend build
- Contracts: Solidity contracts in `contracts/`

## Repo Layout

- `frontend/` - main Next.js app
- `backend/` - Express API server
- `contracts/` - Solidity contracts and scripts
- `public-panel/` - separate Next.js prototype
- `firebase.json` - Firebase Hosting config for the exported frontend

## App Overview

### Public dashboard

Routes:

- `/public`
- `/public/analytics`

The public dashboard is open in the current hackathon setup and does not require Clerk sign-in.

### Admin dashboard

Routes:

- `/admin/login`
- `/admin/dashboard`

The admin flow currently supports local demo auth.

Demo login:

- email containing `admin`
- password `admin123`

### Backend fallback behavior

The backend is designed to return fallback data for demo-critical dashboard endpoints when live providers are unavailable.

This includes:

- stablecoins
- market overview
- news
- networks
- treasuries
- commodities

## Local Development

### Requirements

- Node.js 18+
- npm

Optional for fuller backend behavior:

- PostgreSQL
- Monad RPC and deployed contract addresses
- Clerk keys

### Install dependencies

Frontend:

```bash
cd frontend
npm install --legacy-peer-deps
```

Backend:

```bash
cd backend
npm install
```

### Environment files

Frontend:

- `frontend/.env.local`

Minimal frontend value:

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
```

Backend:

- `backend/.env`

Minimal local backend values can be enough to boot the demo server, but full blockchain and database features require the values from `backend/.env.example`.

### Run locally

Backend:

```bash
cd backend
node server.js
```

Frontend:

```bash
cd frontend
npm run dev
```

Local URLs:

- frontend: `http://localhost:3000`
- backend: `http://localhost:3001`

## Useful Backend Routes

- `GET /api/gold-price`
- `GET /api/dashboard/stablecoins`
- `GET /api/dashboard/market-overview`
- `GET /api/dashboard/news`
- `GET /api/dashboard/networks`
- `GET /api/dashboard/us-treasuries`
- `GET /api/dashboard/commodities`
- `GET /api/blockchain/public/records`

## Firebase Hosting

This repo is configured to deploy the exported frontend from:

- `frontend/out`

Build the frontend:

```bash
cd frontend
npm run build
```

Deploy:

```bash
cd ..
firebase deploy --only hosting
```

Firebase project:

- `phenox-gold-rwa`

Live URL:

- `https://phenox-gold-rwa.web.app`

## Important Deployment Note

Firebase Hosting deploys the frontend only.

If the frontend is built with `NEXT_PUBLIC_BACKEND_URL=http://localhost:3001`, public dashboard API calls will fail outside your local machine. For a fully live demo, rebuild the frontend with a real public backend URL.

## Smart Contracts

Contracts live in `contracts/`.

Typical commands:

```bash
cd contracts
npm install
npx hardhat compile
```

Monad testnet reference:

- RPC: `https://testnet-rpc.monad.xyz`
- Chain ID: `10143`
- Explorer: `https://testnet.monadvision.com`

## Hackathon Notes

This codebase is currently optimized for demo reliability over strict production setup:

- public routes do not require Clerk
- admin login supports demo credentials
- backend dashboard endpoints prefer fallback data over blank failure states
- Firebase Hosting serves a static export of the frontend
