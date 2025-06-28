import { ethers } from "hardhat";
import { expect } from "chai";
import { BankToken } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

let ownerAddress: HardhatEthersSigner,
  userAddress: HardhatEthersSigner,
  secondUserAddress: HardhatEthersSigner;

let bankTokenContract: BankToken;

describe("BankToken", function () {
  this.beforeEach(async () => {
    const [owner, user, secondUser] = await ethers.getSigners();
    ownerAddress = owner;
    userAddress = user;
    secondUserAddress = userAddress;
    const BankToken = await ethers.getContractFactory("BankToken");
    bankTokenContract = (await BankToken.deploy(
      ownerAddress.address
    )) as unknown as BankToken;
    // Fungsi ini memastikan bahwa kontrak benar-benar sudah ter-deploy di jaringan sebelum kamu mulai memanggil fungsi-fungsi lain seperti totalSupply() atau balanceOf().
    await bankTokenContract.waitForDeployment();
  });

  it("Deploy BankToken contract", async function () {
    const decimals = await bankTokenContract.decimals();
    const expectedSupply = ethers.parseUnits("1000000000", decimals); // 1_000_000_000 * 10^decimals

    const totalSupply = await bankTokenContract.totalSupply(); //BNX Token
    const ownerBalance = await bankTokenContract.balanceOf(
      ownerAddress.address
    ); //BNX Token

    expect(totalSupply).to.equal(expectedSupply);
    expect(ownerBalance).to.equal(expectedSupply);
  });

  it("Only owner can make a pause", async () => {
    //pause adalah Fungsi yang dijalankan untuk mengaktifkan mode pause kontrak (menonaktifkan operasi tertentu). Contohnya pause() biasanya mengubah state kontrak agar berhenti menerima transaksi tertentu.

    await expect(bankTokenContract.connect(ownerAddress).pause())
      // .to tidak menjalankan logika apapun sendiri, tapi hanya penghubung ke method assertion selanjutnya (equal, emit, revertedWith, dst).

      //emit : Memeriksa apakah suatu event tertentu di-emit oleh kontrak setelah menjalankan transaksi.
      .to.emit(bankTokenContract, "PauseContract")

      //withArgs : Memastikan event yang dipancarkan mengandung argumen yang sesuai
      .withArgs(ownerAddress.address);

    //paused adalah Variabel boolean yang menunjukkan apakah kontrak sedang dalam kondisi pause (true/false). Sering dipakai sebagai indikator status di dalam kontrak.

    expect(await bankTokenContract.paused()).to.equal(true);
  });

  it("Only owner can make a unpause", async () => {
    // Fungsi unpause() hanya bisa dipanggil jika kontrak dalam keadaan paused, sesuai dengan modifier whenPaused dari OpenZeppelin.
    await bankTokenContract.connect(ownerAddress).pause();
    await expect(bankTokenContract.connect(ownerAddress).unpause())
      .to.emit(bankTokenContract, "UnpauseContract")
      .withArgs(ownerAddress.address);

    expect(await bankTokenContract.paused()).to.equal(false);
  });

  it("User account can't make a pause", async () => {
    //The .connect(...) method expects a Signer, not a raw address
    await expect(bankTokenContract.connect(userAddress).pause())
      .to //.be method : Ia tidak menjalankan logika apapun, hanya membuat assertion kamu terasa seperti kalimat bahasa Inggris. contoh expect(x).to.be.true
      .be.revertedWithCustomError(bankTokenContract, "Unauthorized")
      .withArgs(userAddress.address);
  });

  it("User account can't make a unpause", async () => {
    await expect(bankTokenContract.connect(userAddress).unpause())
      .be.revertedWithCustomError(bankTokenContract, "Unauthorized")
      .withArgs(userAddress.address);
  });

  it("Only owner can make a transfer", async () => {
    await expect(
      bankTokenContract.connect(ownerAddress).transfer(userAddress, 1000)
    )
      .to.emit(bankTokenContract, "TransferToken")
      .withArgs(userAddress.address, 1000);

    const userTokenBalance = await bankTokenContract.balanceOf(
      userAddress.address
    );
    expect(userTokenBalance).to.equal(1000);
  });

  it("User can't make a transfer", async () => {
    await expect(
      bankTokenContract.connect(userAddress).transfer(userAddress, 1000)
    )
      .to.revertedWithCustomError(bankTokenContract, "Unauthorized")
      .withArgs(userAddress.address);
  });

  it("User can't register twice", async () => {
    await bankTokenContract.connect(userAddress).register();

    await expect(bankTokenContract.connect(userAddress).register())
      .to.revertedWithCustomError(bankTokenContract, "AlreadyRegistered")
      .withArgs(userAddress.address);
  });

  it("Only owner can turn user account into freeze mode", async () => {
    await expect(
      bankTokenContract.connect(ownerAddress).freezeAccount(userAddress)
    ).to.not.be.reverted;
  });

  it("User account can't turn another user into freeze mode", async () => {
    await expect(
      bankTokenContract.connect(userAddress).freezeAccount(secondUserAddress)
    )
      .to.be.revertedWithCustomError(bankTokenContract, "Unauthorized")
      .withArgs(secondUserAddress);
  });

  it("User can make a deposit", async () => {
    // 1. User register terlebih dahulu
    await bankTokenContract.connect(userAddress).register();

    // 2. Hitung jumlah yang akan ditransfer
    const ETHDepositAmount = ethers.parseEther("1"); // 1 ETH in wei
    const ethToUsd = BigInt(2500) * BigInt(1e8); // 2500 USD, 8 desimal
    const usdAmount = (ETHDepositAmount * ethToUsd) / BigInt(1e18); // hasil 8 desimal
    const tokenAmount = usdAmount * BigInt(1e10); // convert ke 18 desimal untuk token

    // 3. Pastikan owner memiliki cukup token (ini sudah ada dari deployment)
    const ownerBalanceBefore = await bankTokenContract.balanceOf(
      ownerAddress.address
    );
    expect(ownerBalanceBefore).to.be.gte(tokenAmount);

    // 4. Cek balance contract ETH sebelum deposit
    const contractETHBalanceBefore = await ethers.provider.getBalance(
      bankTokenContract.target
    );

    // 5. User melakukan deposit (mengirim ETH)
    await expect(
      bankTokenContract
        .connect(userAddress)
        .deposit({ value: ETHDepositAmount })
    )
      .to.emit(bankTokenContract, "TransferToken")
      .withArgs(userAddress.address, tokenAmount);

    // 6. Verifikasi hasil:

    // User sekarang memiliki BNX token
    const userTokenBalance = await bankTokenContract.balanceOf(
      userAddress.address
    );
    expect(userTokenBalance).to.equal(tokenAmount);

    // Owner token balance berkurang
    const ownerBalanceAfter = await bankTokenContract.balanceOf(
      ownerAddress.address
    );
    expect(ownerBalanceAfter).to.equal(ownerBalanceBefore - tokenAmount);

    // Savings user bertambah (dalam USD 8 desimal)
    const userSavings = await bankTokenContract.savings(userAddress.address);
    expect(userSavings).to.equal(usdAmount);

    // Contract menerima ETH
    const contractETHBalanceAfter = await ethers.provider.getBalance(
      bankTokenContract.target
    );
    expect(contractETHBalanceAfter).to.equal(
      contractETHBalanceBefore + ETHDepositAmount
    );

    // 7. Log untuk debugging
    console.log("ETH deposited:", ethers.formatEther(ETHDepositAmount));
    console.log("USD amount (8 decimals):", usdAmount.toString());
    console.log("BNX tokens received:", ethers.formatUnits(tokenAmount, 18));
    console.log(
      "Contract ETH balance:",
      ethers.formatEther(contractETHBalanceAfter)
    );
  });

  it("User can make a withdrawal", async () => {
    await bankTokenContract.connect(userAddress).register();

    const ETHDepositAmount = ethers.parseEther("1"); // 1 ETH in wei
    const ethToUsd = BigInt(2500) * BigInt(1e8); // 2500 USD, 8 desimal
    const usdAmount = (ETHDepositAmount * ethToUsd) / BigInt(1e18); // hasil 8 desimal
    const tokenAmount = usdAmount * BigInt(1e10); // convert ke 18 desimal untuk token

    const ownerBalanceBefore = await bankTokenContract.balanceOf(
      ownerAddress.address
    );
    expect(ownerBalanceBefore).to.be.gte(tokenAmount);

    await expect(
      bankTokenContract
        .connect(userAddress)
        .deposit({ value: ETHDepositAmount })
    )
      .to.emit(bankTokenContract, "TransferToken")
      .withArgs(userAddress.address, tokenAmount);

    const contractETHBalanceBefore = await ethers.provider.getBalance(
      bankTokenContract.target
    );

    const userTokenBalance = await bankTokenContract.balanceOf(
      userAddress.address
    );

    const totalWithdraw = ethers.parseUnits("1000", 18); // 1000 BNX dalam wei
    const usdAmountWithdraw = totalWithdraw / BigInt(1e10); // Convert ke USD (8 decimals)
    const withdrawETHAmount = (usdAmountWithdraw * BigInt(1e18)) / ethToUsd;

    await expect(bankTokenContract.connect(userAddress).withdraw(totalWithdraw))
      .to.emit(bankTokenContract, "Withdraw")
      .withArgs(userAddress.address, usdAmountWithdraw, withdrawETHAmount);

    const contractETHBalanceAfter = await ethers.provider.getBalance(
      bankTokenContract.target
    );

    const userTokenBalanceAfter = await bankTokenContract.balanceOf(
      userAddress.address
    );

    console.log(
      "contract ETH Balance Before :",
      ethers.formatEther(contractETHBalanceBefore)
    );
    console.log(
      "Contract ETH Balance Now :",
      ethers.formatEther(contractETHBalanceAfter)
    );

    console.log(
      "User BNX Token Before : ",
      ethers.formatUnits(userTokenBalance, 18)
    );
    console.log(
      "User BNX Token After : ",
      ethers.formatUnits(userTokenBalanceAfter, 18)
    );
  });
});
