const UpgradeableTokenMock = artifacts.require("UpgradeableTokenMock");
const UpgradeAgentMock = artifacts.require("UpgradeAgentMock");
const TokenVault = artifacts.require("TokenVault");

contract("Xelora Smart Contracts Security Tests", accounts => {
  const [owner1, owner2, beneficiary] = accounts;
  
  // Decimals is 18, so we scale by 10^18
  const decimalsMultiplier = web3.utils.toBN(10).pow(web3.utils.toBN(18));
  const totalSupply = web3.utils.toBN(1000000).mul(decimalsMultiplier);

  let token;
  let agent;
  let vault;

  beforeEach(async () => {
    // Deploy UpgradeableTokenMock
    token = await UpgradeableTokenMock.new(totalSupply, { from: owner1 });

    // Deploy UpgradeAgentMock
    agent = await UpgradeAgentMock.new(totalSupply, { from: owner1 });

    // Deploy TokenVault
    const allocationAmount = web3.utils.toBN(100).mul(decimalsMultiplier);
    const vestingPeriod = 3600; // 1 hour
    vault = await TokenVault.new(token.address, allocationAmount, vestingPeriod, { from: owner1 });
  });

  describe("Multiownable Consensus Setup", () => {
    it("should initialize with deployer as sole owner and threshold of 1", async () => {
      const required = await token.required();
      assert.equal(required.toString(), "1", "Threshold must be 1");
      const owners = await token.getOwners();
      assert.equal(owners.length, 1, "There should be exactly 1 owner");
      assert.equal(owners[0], owner1, "Initial owner must be owner1");
    });

    it("should allow adding an owner", async () => {
      await token.addOwner(owner2, { from: owner1 });
      const owners = await token.getOwners();
      assert.equal(owners.length, 2, "There should be exactly 2 owners");
      assert.isTrue(owners.includes(owner2), "Owners list must include owner2");
    });

    it("should allow changing the consensus threshold", async () => {
      await token.addOwner(owner2, { from: owner1 });
      await token.changeRequirement(2, { from: owner1 });
      const required = await token.required();
      assert.equal(required.toString(), "2", "Threshold must be 2");
    });

    it("should enforce the threshold requirement for setUpgradeAgent", async () => {
      await token.addOwner(owner2, { from: owner1 });
      await token.changeRequirement(2, { from: owner1 });

      const agentAddress = agent.address;

      // Owner 1 proposes
      await token.setUpgradeAgent(agentAddress, { from: owner1 });
      
      // It should NOT be set yet since 2 approvals are required
      const currentAgent = await token.upgradeAgent();
      assert.equal(currentAgent, "0x0000000000000000000000000000000000000000", "Upgrade agent should not be set yet");

      // Owner 2 confirms
      await token.setUpgradeAgent(agentAddress, { from: owner2 });
      
      // Now it should be set
      const updatedAgent = await token.upgradeAgent();
      assert.equal(updatedAgent, agentAddress, "Upgrade agent should be set");
    });

    it("should prevent duplicate confirmations by the same owner", async () => {
      await token.addOwner(owner2, { from: owner1 });
      await token.changeRequirement(2, { from: owner1 });

      const agentAddress = agent.address;

      // Owner 1 calls once
      await token.setUpgradeAgent(agentAddress, { from: owner1 });

      // Owner 1 calls again (duplicate) - should remain at 1 confirmation and not set
      await token.setUpgradeAgent(agentAddress, { from: owner1 });
      
      const currentAgent = await token.upgradeAgent();
      assert.equal(currentAgent, "0x0000000000000000000000000000000000000000", "Upgrade agent should not be set");
    });
  });

  describe("TokenVault DoS Protection", () => {
    it("should lock the vault successfully even if excess tokens are directly transferred", async () => {
      const vaultAddress = vault.address;
      const allocationAmount = web3.utils.toBN(100).mul(decimalsMultiplier);

      // Fund the vault with expected allocation
      await token.transfer(vaultAddress, allocationAmount, { from: owner1 });

      // Set allocation for beneficiary
      await vault.setAllocation(beneficiary, allocationAmount, { from: owner1 });

      // Maliciously transfer 1 extra wei directly to the TokenVault
      await token.transfer(vaultAddress, 1, { from: owner1 });

      // Try locking. In the fixed code, this should succeed.
      let success = true;
      try {
        await vault.lock({ from: owner1 });
      } catch (error) {
        success = false;
      }
      assert.isTrue(success, "Vault locking should succeed even with excess balance");

      const lockedAt = await vault.lockedAt();
      assert.isTrue(lockedAt.toNumber() > 0, "Vault lockedAt should be set");
    });
  });
});
