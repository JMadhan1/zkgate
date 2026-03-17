const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ZKGate System", function () {
  let verifier, registry, zkGate, consumer;
  let owner, user, issuer;

  beforeEach(async function () {
    [owner, user, issuer] = await ethers.getSigners();

    const ZKVerifier = await ethers.getContractFactory("ZKVerifier");
    verifier = await ZKVerifier.deploy();

    const ZKCredentialRegistry = await ethers.getContractFactory("ZKCredentialRegistry");
    registry = await ZKCredentialRegistry.deploy();

    const ZKGate = await ethers.getContractFactory("ZKGate");
    zkGate = await ZKGate.deploy(await verifier.getAddress(), await registry.getAddress());

    const ZKGateConsumer = await ethers.getContractFactory("ZKGateConsumer");
    consumer = await ZKGateConsumer.deploy(await zkGate.getAddress());

    // Setup issuer
    await registry.addIssuer(issuer.address);
  });

  describe("Deployment", function () {
    it("Should set the correct verifier and registry addresses", async function () {
      expect(await zkGate.verifier()).to.equal(await verifier.getAddress());
      expect(await zkGate.registry()).to.equal(await registry.getAddress());
    });
  });

  describe("Credential Registry", function () {
    it("Should allow issuer to update root", async function () {
      const newRoot = ethers.keccak256(ethers.toUtf8Bytes("merkle_root_v1"));
      await expect(registry.connect(issuer).updateRoot(newRoot))
        .to.emit(registry, "RootUpdated");
      expect(await registry.isValidRoot(newRoot)).to.be.true;
    });

    it("Should prevent non-issuer from updating root", async function () {
      const newRoot = ethers.keccak256(ethers.toUtf8Bytes("fraudulent_root"));
      await expect(registry.connect(user).updateRoot(newRoot))
        .to.be.revertedWith("ZKCredentialRegistry: Caller is not an authorized issuer");
    });
  });

  describe("ZKGate Verification", function () {
    it("Should grant access after valid ZK proof submission", async function () {
      const root = ethers.keccak256(ethers.toUtf8Bytes("valid_root"));
      await registry.connect(issuer).updateRoot(root);

      const credType = 3; // KYC_COMPLETE
      const timestamp = Math.floor(Date.now() / 1000);
      const nullifierHash = ethers.keccak256(ethers.toUtf8Bytes("unique_nullifier_1"));

      const publicInputs = [
        root,
        credType,
        timestamp,
        nullifierHash
      ];

      // Mock proof (3 uint256[2] arrays encoded)
      const proof = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256[2]", "uint256[2][2]", "uint256[2]"],
        [
          [1, 2],
          [[3, 4], [5, 6]],
          [7, 8]
        ]
      );

      await expect(zkGate.connect(user).verifyIdentity(proof, publicInputs))
        .to.emit(zkGate, "VerificationCompleted")
        .withArgs(user.address, credType, nullifierHash);

      expect(await zkGate.hasAccess(user.address, credType)).to.be.true;
    });
  });

  describe("DeFi Integration", function () {
    it("Should allow deposit only for verified users", async function () {
      // 1. Unverified user attempt
      await expect(consumer.connect(user).deposit({ value: ethers.parseEther("1") }))
        .to.be.revertedWith("ZKGateConsumer: KYC required for deposit");

      // 2. Verify user
      const root = ethers.keccak256(ethers.toUtf8Bytes("valid_root"));
      await registry.connect(issuer).updateRoot(root);
      const nullifierHash = ethers.keccak256(ethers.toUtf8Bytes("unique_nullifier_1"));
      const publicInputs = [root, 3, Math.floor(Date.now() / 1000), nullifierHash];
      const proof = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256[2]", "uint256[2][2]", "uint256[2]"],
        [[1, 2], [[3, 4], [5, 6]], [7, 8]]
      );
      await zkGate.connect(user).verifyIdentity(proof, publicInputs);

      // 3. Verified user attempt
      await expect(consumer.connect(user).deposit({ value: ethers.parseEther("1") }))
        .to.emit(consumer, "Deposited")
        .withArgs(user.address, ethers.parseEther("1"));
    });
  });
});
