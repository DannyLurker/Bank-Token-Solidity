// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "hardhat/console.sol";

contract BankToken is ERC20, ERC20Permit, ERC20Pausable, Ownable {
    address public tokenOwnerAddress;
    
    event pauseContract(address account);
    event unpauseContract(address account);
    event transferToken(address to,uint amount);

    modifier onlyTokenOwner() {
        require(msg.sender == tokenOwnerAddress, "Only vault can call");
        _;
    }

    constructor(address initialOwner)
        ERC20("BankNext", "BNX")
        Ownable(initialOwner)
        ERC20Permit("BankNext")
    {
        tokenOwnerAddress = initialOwner;
        uint256 initialSupply = 1_000_000_000 * 10 ** decimals(); //Solidity dan EVM tidak memiliki tipe float atau decimal seperti di bahasa lain. Token ERC20 diukur dalam satuan terkecilnya 
        _mint(tokenOwnerAddress, initialSupply);
    }

    function pause() public onlyTokenOwner {
        emit pauseContract(tokenOwnerAddress);
        _pause();
    }

    function unpause() public onlyTokenOwner {
        emit unpauseContract(tokenOwnerAddress);
        _unpause();
    }

    function transfer(address to, uint256 amount) public override onlyTokenOwner returns (bool) {
        emit transferToken(to, amount);
        return super.transfer(to, amount);
    }

    function transferFrom(address from, address to, uint256 amount) public override onlyTokenOwner returns(bool) {
        return super.transferFrom(from, to, amount);
    }

    function _mint(address to, uint256 amount) internal pure override {
        revert("Minting is disabled");
    }
    function _update(address from, address to, uint256 value) internal override(ERC20, ERC20Pausable) {
        super._update(from, to, value);
    }

}