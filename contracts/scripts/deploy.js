const hre = require("hardhat");

async function main() {
  const GoldToken = await hre.ethers.getContractFactory("GoldToken");
  const goldToken = await GoldToken.deploy();
  await goldToken.deployed();
  console.log("GoldToken deployed to:", goldToken.address);

  const GoldBatchManager = await hre.ethers.getContractFactory("GoldBatchManager");
  const goldBatchManager = await GoldBatchManager.deploy();
  await goldBatchManager.deployed();
  console.log("GoldBatchManager deployed to:", goldBatchManager.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
