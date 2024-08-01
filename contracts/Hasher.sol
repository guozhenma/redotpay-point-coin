// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library Hasher {
    function hashMintAndBurn(
        string memory orderId,
        address account,
        uint256 amount,
        uint256 expireTime
    ) internal view returns (bytes32) {
        bytes32 operationHash = keccak256(
            abi.encodePacked(
                orderId,
                block.chainid,
                account,
                amount,
                expireTime,
                address(this)
            )
        );
        return operationHash;
    }
}
