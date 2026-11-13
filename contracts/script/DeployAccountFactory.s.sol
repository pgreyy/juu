// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {JuuAccountFactory} from "../src/JuuAccount.sol";

/// Deploys the Juu account factory (Door 3) for a MUSDash game (GAME). Main stack, Mezo's real PriceFeed.
contract DeployAccountFactory is Script {
    function run() external {
        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        JuuAccountFactory factory = new JuuAccountFactory(
            0xCdF7028ceAB81fA0C6971208e83fa7872994beE5, // BorrowerOperations
            0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0, // TroveManager
            0x86bCF0841622a5dAC14A313a15f96A95421b9366, // PriceFeed
            0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503, // MUSD
            0x7b7C000000000000000000000000000000000000, // BTC
            vm.envAddress("GAME"),
            0x9a1ff7FE3a0F69959A3fBa1F1e5ee18e1A9CD7E9, // Router
            0x4947243CC818b627A5D06d14C4eCe7398A23Ce1A // PoolFactory
        );
        vm.stopBroadcast();
        console.log("JuuAccountFactory", address(factory));
    }
}
