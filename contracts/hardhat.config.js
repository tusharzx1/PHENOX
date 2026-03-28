require("@nomiclabs/hardhat-waffle");
require("dotenv").config();

module.exports = {
  solidity: "0.8.20",
  networks: {
    monadTestnet: {
      url: "https://testnet-rpc.monad.xyz/", // replace with actual RPC
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [], // store in .env
    },
  },
};
