// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const BankToken = buildModule("BankToken", (m) => {
  const owner = m.getAccount(0);

  const token = m.contract("BankToken", [owner], {});

  return { token };
});

export default BankToken;
