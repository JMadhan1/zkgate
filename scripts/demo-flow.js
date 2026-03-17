const hre = require("hardhat");
const axios = require('axios');

async function main() {
  console.log("\n🚀 Starting ZKGate End-to-End Demo Flow\n");

  const [owner, user, issuer] = await hre.ethers.getSigners();
  console.log("Participants:");
  console.log(" - Owner:", owner.address);
  console.log(" - Issuer:", issuer.address);
  console.log(" - User:", user.address);

  // 1. DEPLOYMENT
  console.log("\n--- Phase 1: Deployment ---");
  const Verifier = await hre.ethers.getContractFactory("ZKVerifier");
  const verifier = await Verifier.deploy();
  await verifier.waitForDeployment();

  const Registry = await hre.ethers.getContractFactory("ZKCredentialRegistry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();

  const ZKGate = await hre.ethers.getContractFactory("ZKGate");
  const zkGate = await ZKGate.deploy(await verifier.getAddress(), await registry.getAddress());
  await zkGate.waitForDeployment();

  const Consumer = await hre.ethers.getContractFactory("ZKGateConsumer");
  const consumer = await Consumer.deploy(await zkGate.getAddress());
  await consumer.waitForDeployment();

  console.log("✔ Contracts deployed.");

  // 2. SETUP ISSUER
  console.log("\n--- Phase 2: Setup ---");
  await registry.addIssuer(issuer.address);
  console.log("✔ Issuer authorized.");

  // 3. ISSUE CREDENTIAL (MOCK BACKEND)
  console.log("\n--- Phase 3: Credential Issuance ---");
  // In a real flow, this would call our Express server
  // For the script, we simulate the logic
  const rootStr = "valid_merkle_root_demo";
  const root = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(rootStr));
  await registry.connect(issuer).updateRoot(root);
  console.log("✔ Merkle Root updated in Registry:", root);

  // 4. GENERATE PROOF & VERIFY
  console.log("\n--- Phase 4: Verification ---");
  const credType = 3; // KYC_COMPLETE
  const timestamp = Math.floor(Date.now() / 1000);
  const nullifierHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("demo_nullifier_" + Date.now()));

  const publicInputs = [root, credType, timestamp, nullifierHash];
  
  // Encode mock proof
  const proof = hre.ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint256[2]", "uint256[2][2]", "uint256[2]"],
    [[1, 2], [[3, 4], [5, 6]], [7, 8]]
  );

  console.log("Sending ZK verification transaction...");
  const tx = await zkGate.connect(user).verifyIdentity(proof, publicInputs);
  await tx.wait();
  console.log("✔ Identity verified on HashKey Chain!");

  // 5. DEFI INTERACTION
  console.log("\n--- Phase 5: DeFi Access ---");
  console.log("User attempting to deposit 1 ETH into HashLending...");
  const depositTx = await consumer.connect(user).deposit({ value: hre.ethers.parseEther("1") });
  await depositTx.wait();
  console.log("✔ Deposit successful! Access granted by ZKGate.");

  const balance = await consumer.balances(user.address);
  console.log("\nFinal User Balance in Consumer Contract:", hre.ethers.formatEther(balance), "HSK");

  console.log("\n✨ DEMO COMPLETED SUCCESSFULLY ✨\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
