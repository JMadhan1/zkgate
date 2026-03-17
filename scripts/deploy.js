const hre = require("hardhat");

async function main() {
  console.log("Starting ZKGate Deployment...");

  // 1. Deploy ZKVerifier
  const ZKVerifier = await hre.ethers.getContractFactory("ZKVerifier");
  const verifier = await ZKVerifier.deploy();
  await verifier.waitForDeployment();
  console.log("ZKVerifier deployed to:", await verifier.getAddress());

  // 2. Deploy ZKCredentialRegistry
  const ZKCredentialRegistry = await hre.ethers.getContractFactory("ZKCredentialRegistry");
  const registry = await ZKCredentialRegistry.deploy();
  await registry.waitForDeployment();
  console.log("ZKCredentialRegistry deployed to:", await registry.getAddress());

  // 3. Deploy ZKGate
  const ZKGate = await hre.ethers.getContractFactory("ZKGate");
  const zkGate = await ZKGate.deploy(await verifier.getAddress(), await registry.getAddress());
  await zkGate.waitForDeployment();
  console.log("ZKGate deployed to:", await zkGate.getAddress());

  // 4. Deploy ZKGateConsumer (Example DeFi Integration)
  const ZKGateConsumer = await hre.ethers.getContractFactory("ZKGateConsumer");
  const consumer = await ZKGateConsumer.deploy(await zkGate.getAddress());
  await consumer.waitForDeployment();
  console.log("ZKGateConsumer (DeFi Demo) deployed to:", await consumer.getAddress());

  console.log("Deployment completed successfully!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
