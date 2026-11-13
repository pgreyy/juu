// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {JuuBank} from "../src/JuuBank.sol";

/// Deploys JuuBank on Mezo testnet. MUSDash is connected later with setGame.
/// Run from contracts/:  set -a; source ../.env; set +a
///   FOUNDRY_EVM_VERSION=osaka forge script script/DeployBank.s.sol --rpc-url $MEZO_RPC_URL --broadcast --slow --gas-estimate-multiplier 150
contract DeployBank is Script {
    address constant BORROWER_OPERATIONS = 0xCdF7028ceAB81fA0C6971208e83fa7872994beE5;
    address constant TROVE_MANAGER = 0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0;
    address constant PRICE_FEED = 0x86bCF0841622a5dAC14A313a15f96A95421b9366;
    address constant MUSD = 0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503;

    function run() external {
        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        JuuBank bank = new JuuBank(BORROWER_OPERATIONS, TROVE_MANAGER, PRICE_FEED, MUSD);
        vm.stopBroadcast();
        console.log("JuuBank", address(bank));
    }
}
