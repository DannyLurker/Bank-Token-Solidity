// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./BankToken.sol";
import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

contract Vault  {
    address public initialVaultAddress;
    BankToken public bankToken;
    AggregatorV3Interface internal priceFeed;

    event AccountFrozen(address indexed account);
    event AccountUnfrozen(address indexed account);
    event AccountActive(address indexed account);
    event Accountunactive(address indexed account);
    event Withdraw(address indexed user, uint256 usdAmount, uint256 ethAmount);
    
    constructor(address initialOwner, address _bankToken) {
        initialVaultAddress = initialOwner;
        bankToken = BankToken(_bankToken);
        priceFeed = AggregatorV3Interface(0x694AA1769357215DE4FAC081bf1f309aDC325306);
    }

    modifier onlyVault() {
        require(msg.sender == initialVaultAddress, "Only vault can call");
        _;
    }

    mapping(address => uint256) public savings;
    mapping (address=> bool) isActive;
    mapping (address => bool) frozen;

    function register () external {
        require(!isActive[msg.sender], "Already Register");
        isActive[msg.sender] = true;
        emit AccountActive(msg.sender);

        frozen[msg.sender] = false;
        emit AccountUnfrozen(msg.sender);
    }

    function freezeAccount(address account) external onlyVault {
        frozen[account] = true;
        emit AccountFrozen(account);
    }

    function unfreezeAccount(address account) external onlyVault {
        frozen[account] = false;
        emit AccountUnfrozen(account);
    }

    function getETHtoUSD(uint256 ethAmount) public view returns (uint256) {
        (, int price,,,) = priceFeed.latestRoundData();
        // price is 8 decimals, ethAmount is 18 decimals
        return ethAmount * uint256(price) / 1e26; // (eth * price) / 1e18 / 1e8
    }

    function deposit() external payable {
        require(isActive[msg.sender] == true && frozen[msg.sender] == false, "Deposit failed: inactive account or frozen.");
        require(msg.value > 0, "Send ETH");
        uint256 ethAmount = msg.value;
        uint256 usdAmount = getETHtoUSD(ethAmount);
        savings[msg.sender] += usdAmount;
        bankToken.transfer(msg.sender, usdAmount * 1e18); // 1 USD = 1 BankToken
    }

    function withdraw(uint withdrawValue) external payable {
        require(isActive[msg.sender] && !frozen[msg.sender], "You can't make a withdrawal because your account is either inactive or frozen.");
        require(withdrawValue > 0, "Withdraw value must be greater than zero");
        require(savings[msg.sender] >= withdrawValue, "Insufficient savings");

        uint256 ETHConvertionRate = getETHtoUSD(1);
        uint256 ethAmount = withdrawValue * 1e18 / ETHConvertionRate;

        require(address(this).balance >= ethAmount, "Vault: insufficient ETH balance");
        savings[msg.sender] -= withdrawValue;
        payable(msg.sender).transfer(ethAmount);
        emit Withdraw(msg.sender, withdrawValue, ethAmount);
    }

}