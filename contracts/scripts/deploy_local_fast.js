const fs = require('fs');
const path = require('path');
const { ethers } = require('hardhat');

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying contracts with local account:', deployer.address);

  // Deploy Token
  const GoldToken = await ethers.getContractFactory('GoldToken');
  const token = await GoldToken.deploy();
  await token.deployed();
  console.log('GoldToken deployed to:', token.address);

  // Deploy Batch Manager
  const GoldBatchManager = await ethers.getContractFactory('GoldBatchManager');
  const batchManager = await GoldBatchManager.deploy(token.address);
  await batchManager.deployed();
  console.log('GoldBatchManager deployed to:', batchManager.address);

  // Target User Account
  const targetUser = '0x236739E25E14E24b0f739625fEc2e0A01192C4F8';

  // Fund the user with 100 ETH for gas testing
  await deployer.sendTransaction({
    to: targetUser,
    value: ethers.utils.parseEther("100.0")
  });
  console.log(`Funded ${targetUser} with 100 ETH!`);

  // Grant the admin role to the user's ETH address so they can add batches!
  const DEFAULT_ADMIN_ROLE = await batchManager.DEFAULT_ADMIN_ROLE();
  await batchManager.grantRole(DEFAULT_ADMIN_ROLE, targetUser);
  console.log(`Granted DEFAULT_ADMIN_ROLE on BatchManager to ${targetUser}`);
  
  // Mint 50,000 GoldTokens directly to the user's address for their dashboard
  await token.mint(targetUser, ethers.utils.parseEther("50000"));
  console.log(`Minted 50,000 PGOLD to ${targetUser}`);

  // Copy ABIs and Addresses directly into Next.js frontend
  const frontendDir = path.join(__dirname, '../../frontend');
  const abiDir = path.join(frontendDir, 'src/abi');
  
  // Read Hardhat Artifacts
  const tokenArtifact = await hre.artifacts.readArtifact('GoldToken');
  const batchManagerArtifact = await hre.artifacts.readArtifact('GoldBatchManager');

  fs.writeFileSync(path.join(abiDir, 'GoldToken.json'), JSON.stringify(tokenArtifact.abi, null, 2));
  fs.writeFileSync(path.join(abiDir, 'GoldBatchManager.json'), JSON.stringify(batchManagerArtifact.abi, null, 2));

  // Update frontend addresses
  const dashPath = path.join(frontendDir, 'src/pages/admin/dashboard.tsx');
  let dashboardCode = fs.readFileSync(dashPath, 'utf8');
  dashboardCode = dashboardCode.replace(/const GOLD_TOKEN_ADDRESS = '[^']+';/, `const GOLD_TOKEN_ADDRESS = '${token.address}';`);
  dashboardCode = dashboardCode.replace(/const BATCH_MANAGER_ADDRESS = '[^']+';/, `const BATCH_MANAGER_ADDRESS = '${batchManager.address}';`);
  fs.writeFileSync(dashPath, dashboardCode);

  console.log('Frontend ABI and Addresses perfectly synced!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
