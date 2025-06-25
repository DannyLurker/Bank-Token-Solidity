// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const Vault = buildModule("Vault", (m) => {
  const owner = m.getAccount(1);
  const bankTokenAddress = "0x5fbdb2315678afecb367f032d93f642f64180aa3";
  const vault = m.contract("Vault", [owner, bankTokenAddress], {});

  return { vault };
});

export default Vault;
