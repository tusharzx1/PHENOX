PHENOX – Gold RWA Platform on Monad
PHENOX tokenizes physical gold on the Monad blockchain, combining institutional‑grade security with a social marketplace. Admins authenticate using face recognition + OTP to mint PGOLD tokens (1 token = 1 gram), while every gold batch (weight, purity, location) is recorded immutably on‑chain. The public dashboard lets users connect wallets, trade gold, view real‑time analytics (price, market cap, holder leaderboard), and engage in a social feed where trades automatically generate posts. Built with Next.js, Node.js, PostgreSQL, and Solidity, PHENOX brings transparency, accessibility, and community to gold investment.

Live demo: https://phenox-gold-rwa.web.app

🌟 Features
🔐 Biometric Admin Security – Face login + OTP via Clerk; only authorised admins can mint or burn tokens.

📜 On‑Chain Gold Batches – Each batch (weight, purity, location, certification) stored in a smart contract; fully transparent.

💬 Public Marketplace & Social Feed – Users connect wallet, buy/sell PGOLD, and post updates. On‑chain events auto‑generate feed entries.

📊 Real‑Time Analytics Dashboard – Gold price (USD/INR), total supply, market cap, holder leaderboard, transaction feed, and public gold batch ledger.

⚡ Built on Monad – High throughput, low fees, EVM‑compatible.

🔌 Custom Indexer & APIs – Node.js backend listens to contract events, stores data in PostgreSQL, serves REST endpoints.

🛠 Tech Stack
Layer	Technology
Frontend	Next.js, Tailwind CSS, Clerk (auth), ethers.js
Backend	Node.js, Express, PostgreSQL, node-cron, axios
Blockchain	Solidity, Hardhat, Monad testnet
APIs	GoldPrice.Today (gold price), DeFiLlama (stablecoins)
Deployment	Firebase Hosting (frontend), Render (backend)
🚀 Quick Start
Prerequisites
Node.js v18+

PostgreSQL

MetaMask (or any EVM wallet)

Monad testnet RPC (e.g., from Ankr)

1. Clone the repository
bash
git clone https://github.com/your-username/phenox.git
cd phenox
2. Smart Contracts
bash
cd contracts
npm install
# Create .env with PRIVATE_KEY and MONAD_RPC_URL
npx hardhat run scripts/deploy.js --network monadTestnet
# Save the deployed contract addresses
3. Backend
bash
cd backend
npm install
cp .env.example .env
# Edit .env with DATABASE_URL, contract addresses, CLERK_SECRET_KEY
npm run migrate   # runs PostgreSQL migrations
npm run dev
4. Frontend
bash
cd frontend
npm install
cp .env.local.example .env.local
# Add NEXT_PUBLIC_API_URL (backend URL), Clerk keys, contract addresses
npm run dev
5. Open your browser
Frontend: http://localhost:3000

Backend: http://localhost:3001

🔧 Environment Variables
Backend .env
text
MONAD_RPC_URL=https://rpc.ankr.com/monad_testnet
GOLD_TOKEN_ADDRESS=0x...
BATCH_MANAGER_ADDRESS=0x...
DATABASE_URL=postgresql://user:pass@localhost:5432/phenox
PORT=3001
CLERK_SECRET_KEY=sk_...
Frontend .env.local
text
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_MONAD_RPC_URL=https://rpc.ankr.com/monad_testnet
NEXT_PUBLIC_GOLD_TOKEN_ADDRESS=0x...
📁 Project Structure
text
phenox/
├── contracts/            # Hardhat project
│   ├── contracts/        # GoldToken.sol, GoldBatchManager.sol
│   ├── scripts/          # deploy.js
│   └── hardhat.config.js
├── backend/              # Node.js server
│   ├── routes/           # API endpoints
│   ├── services/         # blockchain, price, indexer
│   ├── db/               # PostgreSQL connection & migrations
│   ├── middlewares/
│   ├── utils/
│   └── server.js
├── frontend/             # Next.js app
│   ├── pages/            # /admin/login, /admin/dashboard, /public/analytics
│   ├── components/
│   ├── hooks/
│   ├── abi/              # Contract ABIs
│   ├── styles/
│   └── next.config.js
└── README.md
🧪 Testing
Smart Contracts: cd contracts && npx hardhat test

Backend: Use Postman or curl to test endpoints (see /backend/README.md)

Frontend: Manual testing of login, wallet connection, and transactions

🚢 Deployment
Frontend: cd frontend && firebase deploy (after setting up Firebase Hosting)

Backend: Deploy on Render or Railway – connect GitHub repo, set environment variables

Database: Use MongoDB Atlas or Supabase (PostgreSQL)

🤝 Contributing
Contributions are welcome! Please open an issue or submit a pull request. Follow the existing coding standards and include tests for new features.

📄 License
MIT © PHENOX Team

🌐 Live Demo
https://phenox-gold-rwa.web.app


