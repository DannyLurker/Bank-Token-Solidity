"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const hardhat_1 = require("hardhat");
const chai_1 = require("chai");
let ownerAddress, userAddress;
let bankTokenContract;
describe("BankToken", function () {
    this.beforeEach(async () => {
        const [owner, user] = await hardhat_1.ethers.getSigners();
        ownerAddress = owner;
        userAddress = user;
        const BankToken = await hardhat_1.ethers.getContractFactory("BankToken");
        bankTokenContract = (await BankToken.deploy(ownerAddress.address));
        // Fungsi ini memastikan bahwa kontrak benar-benar sudah ter-deploy di jaringan sebelum kamu mulai memanggil fungsi-fungsi lain seperti totalSupply() atau balanceOf().
        await bankTokenContract.waitForDeployment();
    });
    it("Deploy BankToken contract", async function () {
        const decimals = await bankTokenContract.decimals();
        const expectedSupply = hardhat_1.ethers.parseUnits("1000000000", decimals); // 1_000_000_000 * 10^decimals
        const totalSupply = await bankTokenContract.totalSupply(); //BNX Token
        const ownerBalance = await bankTokenContract.balanceOf(ownerAddress.address); //BNX Token
        (0, chai_1.expect)(totalSupply).to.equal(expectedSupply);
        (0, chai_1.expect)(ownerBalance).to.equal(expectedSupply);
    });
    it("Only owner can make a pause", async () => {
        //pause adalah Fungsi yang dijalankan untuk mengaktifkan mode pause kontrak (menonaktifkan operasi tertentu). Contohnya pause() biasanya mengubah state kontrak agar berhenti menerima transaksi tertentu.
        await (0, chai_1.expect)(bankTokenContract.connect(ownerAddress).pause())
            // .to tidak menjalankan logika apapun sendiri, tapi hanya penghubung ke method assertion selanjutnya (equal, emit, revertedWith, dst).
            //emit : Memeriksa apakah suatu event tertentu di-emit oleh kontrak setelah menjalankan transaksi.
            .to.emit(bankTokenContract, "pauseContract")
            //withArgs : Memastikan event yang dipancarkan mengandung argumen yang sesuai
            .withArgs(ownerAddress.address);
        //paused adalah Variabel boolean yang menunjukkan apakah kontrak sedang dalam kondisi pause (true/false). Sering dipakai sebagai indikator status di dalam kontrak.
        (0, chai_1.expect)(await bankTokenContract.paused()).to.equal(true);
    });
    it("Only owner can make a unpause", async () => {
        // Fungsi unpause() hanya bisa dipanggil jika kontrak dalam keadaan paused, sesuai dengan modifier whenPaused dari OpenZeppelin.
        await bankTokenContract.connect(ownerAddress).pause();
        await (0, chai_1.expect)(bankTokenContract.connect(ownerAddress).unpause())
            .to.emit(bankTokenContract, "unpauseContract")
            .withArgs(ownerAddress.address);
        (0, chai_1.expect)(await bankTokenContract.paused()).to.equal(false);
    });
    it("User account can't make a pause", async () => {
        await (0, chai_1.expect)(bankTokenContract.connect(userAddress).pause())
            .to //.be method : Ia tidak menjalankan logika apapun, hanya membuat assertion kamu terasa seperti kalimat bahasa Inggris. contoh expect(x).to.be.true
            .be.revertedWith("Only vault can call");
    });
    it("User account can't make a unpause", async () => {
        await (0, chai_1.expect)(bankTokenContract.connect(userAddress).unpause()).be.revertedWith("Only vault can call");
    });
    it("Only owner can make a transfer", async () => {
        await (0, chai_1.expect)(bankTokenContract.connect(ownerAddress).transfer(userAddress, 1000))
            .to.emit(bankTokenContract, "transferToken")
            .withArgs(userAddress.address, 1000);
        const userTokenBalance = await bankTokenContract.balanceOf(userAddress.address);
        (0, chai_1.expect)(userTokenBalance).to.equal(1000);
    });
    it("User can't make a transfer", async () => {
        await (0, chai_1.expect)(bankTokenContract.connect(userAddress).transfer(userAddress, 1000)).to.be.revertedWith("Only vault can call");
    });
    it("Only owner can make a transfer", async () => {
        await (0, chai_1.expect)(bankTokenContract.connect(ownerAddress).transfer(userAddress, 1000))
            .to.emit(bankTokenContract, "transferToken")
            .withArgs(userAddress.address, 1000);
        const userTokenBalance = await bankTokenContract.balanceOf(userAddress.address);
        (0, chai_1.expect)(userTokenBalance).to.equal(1000);
    });
});
