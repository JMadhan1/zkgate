const hre  = require("hardhat");
const fs   = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network    = hre.network.name;
  const chainId    = (await hre.ethers.provider.getNetwork()).chainId;

  console.log("=================================================");
  console.log(" ZKGate Full Deployment");
  console.log("=================================================");
  console.log(` Network:  ${network} (chainId: ${chainId})`);
  console.log(` Deployer: ${deployer.address}`);
  console.log(` Balance:  ${hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address))} HSK`);
  console.log("=================================================\n");

  const deployed = {};
  const txHashes = {};

  async function deploy(name, ...args) {
    console.log(`Deploying ${name}...`);
    const Factory = await hre.ethers.getContractFactory(name);
    const contract = await Factory.deploy(...args);
    await contract.waitForDeployment();
    const addr = await contract.getAddress();
    const tx   = contract.deploymentTransaction()?.hash;
    deployed[name] = addr;
    txHashes[name] = tx;
    console.log(`  ✓ ${name.padEnd(32)} ${addr}`);
    console.log(`    tx: ${tx}\n`);
    return contract;
  }

  // Deploy in order
  await deploy("AgeCheckVerifier");
  await deploy("CredentialCheckVerifier");
  await deploy("SelectiveDisclosureVerifier");
  const registry = await deploy("ZKCredentialRegistry");

  const zkGate = await deploy(
    "ZKGate",
    deployed.AgeCheckVerifier,
    deployed.CredentialCheckVerifier,
    deployed.SelectiveDisclosureVerifier,
    deployed.ZKCredentialRegistry
  );

  await deploy("ZKGateConsumer", deployed.ZKGate);
  await deploy("ZKAirdrop", deployed.ZKGate, 1000);

  // Authorize ZKGate as issuer
  console.log("Authorizing ZKGate as issuer in registry...");
  const authTx = await registry.addIssuer(deployed.ZKGate);
  await authTx.wait();
  console.log(`  ✓ ZKGate authorized (tx: ${authTx.hash})\n`);

  // Write deployments.json
  const deploymentsPath = path.join(__dirname, "../app/app/lib/deployments.json");
  let data = {};
  try { data = JSON.parse(fs.readFileSync(deploymentsPath, "utf8")); } catch {}

  const key = network === "hashkeyTestnet" ? "hashkeyTestnet" : "hashkeyMainnet";
  data[key] = {
    chainId: Number(chainId),
    rpcUrl: network === "hashkeyTestnet"
      ? "https://testnet.hsk.xyz"
      : "https://mainnet.hsk.xyz",
    explorer: network === "hashkeyTestnet"
      ? "https://testnet-explorer.hsk.xyz"
      : "https://explorer.hsk.xyz",
    contracts: deployed,
    deployedAt: new Date().toISOString(),
    deployTxHashes: txHashes,
  };

  fs.writeFileSync(deploymentsPath, JSON.stringify(data, null, 2));
  console.log(`✓ Written to app/app/lib/deployments.json\n`);

  const explorerBase = data[key].explorer;
  console.log("=================================================");
  console.log(" Explorer links:");
  for (const [name, addr] of Object.entries(deployed)) {
    console.log(`   ${explorerBase}/address/${addr}  (${name})`);
  }
  console.log("=================================================\n");
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
