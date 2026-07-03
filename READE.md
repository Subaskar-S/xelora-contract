# 🚀 Test Task 🚀

* Modify the existing function that currently uses `onlyOwner` to utilize a `Multiownable` pattern.
* Include in the README an explanation of the rationale and approach for strengthening security protections.

---

# Xelora Smart Contracts - Security & Architectural Enhancements

This document explains the security vulnerabilities identified in the initial repository, the rationale and implementation of the new `Multiownable` pattern, the remediation steps applied to strengthen contract protections, and the **Truffle** development configuration.

---

## 1. Security Vulnerability Assessments & Remediation

### 1.1. Denial of Service (DoS) via Forced Token Balance in `TokenVault`
* **Vulnerability Description**: 
  In the initial implementation of the `lock()` function in TokenVault.sol the contract checked the vault's balance using a strict equality match:
  ```solidity
  require(token.balanceOf(address(this)) == tokensAllocated, "Vault must own enough tokens to distribute");
  ```
* **Risk & Impact**: 
  Because anyone can send ERC20 tokens directly to any contract address, a malicious actor could transfer a tiny fraction of a token (e.g., 1 wei) directly to the vault. This would force `token.balanceOf(address(this))` to be greater than `tokensAllocated`, causing `lock()` to permanently revert. Since locking is a prerequisite to unlocking and claiming, the vault would be permanently bricked, trapping all beneficiary allocations.
* **Remediation**: 
  Modified the balance check to use a greater-than-or-equal-to comparison (`>=`). Any surplus tokens sent to the vault will no longer block execution, and they can be recovered by the owner using the inherited `reclaimToken()` function.
  ```solidity
  require(token.balanceOf(address(this)) >= tokensAllocated, "Vault must own enough tokens to distribute");
  ```

---

### 1.2. Centralization Risk & Single Point of Failure (`onlyOwner`)
* **Vulnerability Description**: 
  The single-owner administrative model (`onlyOwner` from `Claimable`) governed highly critical actions, particularly setting the `upgradeAgent` for token migration.
* **Risk & Impact**: 
  If the owner's private key is compromised, or if the owner acts maliciously, they have full control to change the upgrade agent (before the migration begins) to a malicious contract, leading to complete loss of user funds upon upgrade.
* **Remediation**: 
  Implemented the `Multiownable` pattern. For critical actions like `setUpgradeAgent`, the contract now requires a threshold (multi-signature) consensus among a list of designated owners before execution.

---

### 1.3. Outdated Solidity Compiler (`0.4.23`)
* **Vulnerability Description**: 
  The contracts initially specified a strict old version `pragma solidity 0.4.23;`.
* **Risk & Impact**: 
  Older compilers contain known optimizer and memory bugs. Standard OpenZeppelin dependencies also require modern compilers.
* **Remediation**: 
  Relaxed the compiler version constraints to `^0.4.23` across all contracts, allowing the codebase to be compiled and verified with the more stable and secure `0.4.26` compiler (the final version of the 0.4.x series).

---

## 2. Multiownable Architecture Design

The `Multiownable` pattern was implemented in Multiownable.sol

### 2.1. Consensus Modifier (`onlyManyOwners`)
Rather than requiring separate proposal, vote, and execution transactions, we implemented an elegant, state-persisted consensus flow.
Owners call the target function directly with identical arguments.
* An operation hash `opHash` is computed dynamically as `keccak256(msg.data)`.
* Each owner calling the function confirms their intent, incrementing the confirmation count for that `opHash`.
* Once the confirmations meet the required threshold (`required`), the function body is executed.
* An `executed[opHash]` flag is set to true to prevent replay/duplicate execution of the same call.

### 2.2. Dynamic Owner Management
To maintain backward compatibility and avoid breaking inheritance chains, `Multiownable` defaults to initializing the deployer as a single owner with a required threshold of `1`.
Once deployed, the owners can collaboratively call:
* `addOwner(address newOwner)`: Adds a new owner to the registry.
* `removeOwner(address owner)`: Removes an existing owner, automatically adjusting the requirement threshold if necessary.
* `changeRequirement(uint256 _required)`: Updates the required threshold of owner approvals.

---

## 3. Development and Verification using Truffle

The project is structured under the standard **Truffle** framework.

### 3.1. Structure
* **`./` (Root)**: Location of Solidity smart contracts, maintaining the original project structure.
* **`test/`**: Mocha JS unit tests.
* **`truffle-config.js`**: Compiler optimizer configuration and path mappings.

### 3.2. Commands
To install dependencies:
```bash
npm install
```

To compile all contracts:
```bash
npm run compile
```

To run the security and consensus test suite:
```bash
npm run test
```