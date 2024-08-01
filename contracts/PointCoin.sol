// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

import {ECDSAHelper} from "./ECDSAHelper.sol";
import {Hasher} from "./Hasher.sol";

contract PointCoin is
    ERC20Upgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable
{
    uint256 private MAX_SUPPLY;
    uint8 private DECIMALS;
    address[] private ADMINS; // 管理员，负责mint和burn
    address private BURN_ADDRESS;

    function initalize(
        address owner,
        uint256 maxSupply_,
        string memory name,
        string memory symbol,
        uint8 decimals_,
        address[] memory admins_,
        address burnAddress_
    ) external initializer {
        require(owner != address(0), "invalid owner address");
        require(burnAddress_ != address(0), "invalid burn address");
        require(admins_.length == 3, "invalid admins length");
        require(admins_[0] != admins_[1], "must be different admins");
        require(admins_[0] != admins_[2], "must be different admins");
        require(admins_[1] != admins_[2], "must be different admins");

        __Ownable_init(owner);
        __ERC20_init(name, symbol);
        __ReentrancyGuard_init();

        MAX_SUPPLY = maxSupply_;
        DECIMALS = decimals_;
        ADMINS = admins_;
        BURN_ADDRESS = burnAddress_;
    }

    // ============================ getters ============================
    function maxSupply() public view returns (uint256) {
        return MAX_SUPPLY;
    }

    function admins() public view returns (address[] memory) {
        return ADMINS;
    }

    function decimals() public view virtual override returns (uint8) {
        return DECIMALS;
    }

    function burnAddress() public view returns (address) {
        return BURN_ADDRESS;
    }

    // ============================ for owner ============================
    function setAdmins(address[] memory admins_) external onlyOwner {
        require(admins_.length == 3, "invalid admins length");
        require(admins_[0] != admins_[1], "must be different admins");
        require(admins_[0] != admins_[2], "must be different admins");
        require(admins_[1] != admins_[2], "must be different admins");

        ADMINS = admins_;
    }

    // ============================ for admins ============================
    function mint(
        string memory orderId,
        address account,
        uint256 amount,
        uint256 expireTime,
        address[] memory signers,
        bytes[] memory signatures
    ) external nonReentrant {
        require(signers.length >= 2, "invalid signers length");
        require(signers.length == signatures.length, "arrays length mismatch");
        require(signers[0] != signers[1], "can not be same signer");
        require(expireTime >= block.timestamp, "expired transaction");

        require(
            totalSupply() + amount <= MAX_SUPPLY,
            "maximum supply exceeded"
        );

        bytes32 operationHash = ECDSAHelper.toEthSignedMessageHash(
            Hasher.hashMintAndBurn(orderId, account, amount, expireTime)
        );

        for (uint8 index = 0; index < signers.length; index++) {
            address signer = ECDSA.recover(operationHash, signatures[index]);
            require(signer == signers[index], "invalid signer");
            require(_isAllowedSigner(signer), "not allowed signer");
        }
        _mint(account, amount);
    }

    function burn(
        string memory orderId,
        uint256 amount,
        uint256 expireTime,
        address[] memory signers,
        bytes[] memory signatures
    ) external nonReentrant {
        require(signers.length >= 2, "invalid signers length");
        require(signers.length == signatures.length, "arrays length mismatch");
        require(signers[0] != signers[1], "can not be same signer");
        require(expireTime >= block.timestamp, "expired transaction");

        require(balanceOf(BURN_ADDRESS) >= amount, "burn amount exceeded");

        bytes32 operationHash = ECDSAHelper.toEthSignedMessageHash(
            Hasher.hashMintAndBurn(orderId, BURN_ADDRESS, amount, expireTime)
        );

        for (uint8 index = 0; index < signers.length; index++) {
            address signer = ECDSA.recover(operationHash, signatures[index]);
            require(signer == signers[index], "invalid signer");
            require(_isAllowedSigner(signer), "not allowed signer");
        }

        _burn(BURN_ADDRESS, amount);
    }

    // ============================ internal ============================
    function _isAllowedSigner(address signer) internal view returns (bool) {
        for (uint i = 0; i < ADMINS.length; i++) {
            if (ADMINS[i] == signer) {
                return true;
            }
        }
        return false;
    }
}
