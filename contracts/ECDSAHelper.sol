// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library ECDSAHelper {
    function toEthSignedMessageHash(
        bytes32 messageHash
    ) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    "\x19Ethereum Signed Message:\n32",
                    messageHash
                )
            );
    }
}
