const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const ZKGATE_ADDRESS = process.env.ZKGATE_ADDRESS;
  if (!ZKGATE_ADDRESS) {
    throw new Error("Set ZKGATE_ADDRESS env var to your deployed ZKGate contract address");
  }

  // Deploy ZKBadge
  console.log("\nDeploying ZKBadge...");
  const ZKBadge = await ethers.getContractFactory("ZKBadge");
  const zkBadge = await ZKBadge.deploy(ZKGATE_ADDRESS);
  await zkBadge.waitForDeployment();
  console.log("ZKBadge deployed to:", await zkBadge.getAddress());

  // Deploy MockLendingPool
  console.log("\nDeploying MockLendingPool...");
  const MockLendingPool = await ethers.getContractFactory("MockLendingPool");
  const pool = await MockLendingPool.deploy(ZKGATE_ADDRESS);
  await pool.waitForDeployment();
  console.log("MockLendingPool deployed to:", await pool.getAddress());

  // Wire ZKBadge into ZKGate (requires owner)
  console.log("\nWiring ZKBadge into ZKGate...");
  const ZKGate = await ethers.getContractFactory("ZKGate");
  const zkGate = ZKGate.attach(ZKGATE_ADDRESS);
  const tx = await zkGate.setBadgeContract(await zkBadge.getAddress());
  await tx.wait();
  console.log("ZKBadge wired into ZKGate");

  console.log("\n=== Deployment Summary ===");
  console.log("ZKGate:           ", ZKGATE_ADDRESS);
  console.log("ZKBadge:          ", await zkBadge.getAddress());
  console.log("MockLendingPool:  ", await pool.getAddress());
  console.log("\nAdd to your .env:");
  console.log(`NEXT_PUBLIC_ZKBADGE_ADDRESS=${await zkBadge.getAddress()}`);
  console.log(`NEXT_PUBLIC_LENDING_POOL_ADDRESS=${await pool.getAddress()}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
