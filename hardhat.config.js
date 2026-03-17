require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    hashkeyTestnet: {
      url: "https://hashkeychain-testnet.alt.technology",
      chainId: 133,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    hashkeyMainnet: {
      url: "https://hashkeychain-mainnet.alt.technology",
      chainId: 177,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
  gasReporter: {
    enabled: true,
    currency: "USD",
  },
  etherscan: {
    apiKey: {
      hashkeyTestnet: "any-arbitrary-string", // Usually not needed for AltLayer testnets but good to have
    },
    customChains: [
      {
        network: "hashkeyTestnet",
        chainId: 133,
        urls: {
          apiURL: "https://hashkey-testnet-explorer.alt.technology/api",
          browserURL: "https://hashkey-testnet-explorer.alt.technology",
        },
      },
    ],
  },
};
