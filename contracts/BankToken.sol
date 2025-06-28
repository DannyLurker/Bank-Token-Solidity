// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC20Pausable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

contract BankToken is ERC20, ERC20Permit, ERC20Pausable, Ownable {
    address public tokenOwnerAddress;
    AggregatorV3Interface internal priceFeed;

    event PauseContract(address account);
    event UnpauseContract(address account);
    event TransferToken(address to, uint256 amount);
    event AccountFrozen(address indexed account);
    event AccountUnfrozen(address indexed account);
    event AccountActive(address indexed account);
    event Accountunactive(address indexed account);
    event Withdraw(address indexed user, uint256 usdAmount, uint256 ethAmount);
    error Unauthorized(address account);
    error AlreadyRegistered(address account);
    error AccountFreeze(address account);
    error VaultInsufficientBalance(address acoount);
    error InsufficientBalance(address acoount);
    error CantBeZero(address account);
    error TransferFailed(address account);

    mapping(address => uint256) public savings;
    mapping(address => bool) public isActive;
    mapping(address => bool) public frozen;

    modifier onlyTokenOwner() {
        if (msg.sender != tokenOwnerAddress) {
            revert Unauthorized(msg.sender);
        }
        _;
    }

    constructor(
        address initialOwner
    ) ERC20("BankNext", "BNX") Ownable(initialOwner) ERC20Permit("BankNext") {
        tokenOwnerAddress = initialOwner;
        uint256 initialSupply = 1_000_000_000 * 10 ** decimals(); //Solidity dan EVM tidak memiliki tipe float atau decimal seperti di bahasa lain. Token ERC20 diukur dalam satuan terkecilnya
        _mint(tokenOwnerAddress, initialSupply);
        priceFeed = AggregatorV3Interface(
            0x694AA1769357215DE4FAC081bf1f309aDC325306
        );
    }

    function register() external {
        if (isActive[msg.sender] == true) {
            revert AlreadyRegistered(msg.sender);
        }
        isActive[msg.sender] = true;
        emit AccountActive(msg.sender);

        frozen[msg.sender] = false;
        emit AccountUnfrozen(msg.sender);
    }

    function freezeAccount(address account) external onlyTokenOwner {
        frozen[account] = true;
        emit AccountFrozen(account);
    }

    function unfreezeAccount(address account) external onlyTokenOwner {
        frozen[account] = false;
        emit AccountUnfrozen(account);
    }

    function getETHtoUSD(uint256 ethAmount) public view returns (uint256) {
        (, int256 price, , , ) = priceFeed.latestRoundData();
        // price is 8 decimals, ethAmount is 18 decimals
        return (ethAmount * uint256(price)) / 1e26; // (eth * price) / 1e18 / 1e8
    }

    function deposit() external payable {
        if (isActive[msg.sender] == false) {
            revert Unauthorized(msg.sender);
        }

        if (frozen[msg.sender] == true) {
            revert AccountFreeze(msg.sender);
        }

        if (msg.value == 0) {
            revert InsufficientBalance(msg.sender);
        }

        uint256 ethToUsd = 2500 * 1e8; // 8 desimal
        uint256 usdAmount = (msg.value * ethToUsd) / 1e18; // hasil 8 desimal
        uint256 tokenAmount = usdAmount * 1e10; // 1 USD = 1e18 token

        // Pastikan owner memiliki cukup token untuk ditransfer
        if (balanceOf(tokenOwnerAddress) < tokenAmount) {
            revert InsufficientBalance(tokenOwnerAddress);
        }

        //Menggunakan _transfer() bukan transferFrom()
        // _transfer() adalah internal function yang tidak memerlukan allowance
        // Owner tidak perlu approve dulu
        // Transfer BNX dari owner ke user
        _transfer(tokenOwnerAddress, msg.sender, tokenAmount);

        // Simpan record savings dalam USD (8 desimal)
        savings[msg.sender] += usdAmount;

        emit TransferToken(msg.sender, tokenAmount);
    }

    function withdraw(uint256 totalBNXWithdraw) external {
        // Validasi dasar
        if (isActive[msg.sender] == false) {
            revert Unauthorized(msg.sender);
        }

        if (frozen[msg.sender] == true) {
            revert AccountFreeze(msg.sender);
        }

        if (totalBNXWithdraw == 0) {
            revert CantBeZero(msg.sender);
        }

        // Pastikan user memiliki cukup BNX token untuk withdraw
        if (balanceOf(msg.sender) < totalBNXWithdraw) {
            revert InsufficientBalance(msg.sender);
        }

        // Konversi BNX ke USD value (1 BNX = 1 USD)
        // totalBNXWithdraw dalam wei (18 decimals) -> USD dalam 8 decimals
        uint256 usdAmount = totalBNXWithdraw / 1e10;

        // Pastikan user memiliki cukup savings
        if (savings[msg.sender] < usdAmount) {
            revert InsufficientBalance(msg.sender);
        }

        // Konversi USD ke ETH menggunakan rate tetap (untuk localhost testing)
        uint256 ethPriceUSD = 2500 * 1e8; // $2500 per ETH dalam 8 decimals

        // Hitung ETH amount: usdAmount (8 decimals) / ethPrice (8 decimals) * 1e18
        uint256 ethAmount = (usdAmount * 1e18) / ethPriceUSD;

        // Pastikan contract memiliki cukup ETH
        if (address(this).balance < ethAmount) {
            revert VaultInsufficientBalance(address(this));
        }

        // Update state sebelum external call (CEI pattern)
        savings[msg.sender] -= usdAmount;

        // Transfer BNX tokens kembali ke owner
        _transfer(msg.sender, tokenOwnerAddress, totalBNXWithdraw);

        // Transfer ETH ke user
        (bool success, ) = payable(msg.sender).call{value: ethAmount}("");
        if (!success) {
            revert TransferFailed(msg.sender);
        }

        emit Withdraw(msg.sender, usdAmount, ethAmount);
    }

    function pause() public onlyTokenOwner {
        emit PauseContract(tokenOwnerAddress);
        _pause();
    }

    function unpause() public onlyTokenOwner {
        emit UnpauseContract(tokenOwnerAddress);
        _unpause();
    }

    function transfer(
        address to,
        uint256 amount
    ) public override onlyTokenOwner returns (bool) {
        emit TransferToken(to, amount);
        return super.transfer(to, amount);
    }

    function _update(
        address from,
        address to,
        uint256 value
    ) internal override(ERC20, ERC20Pausable) {
        super._update(from, to, value);
    }
}
