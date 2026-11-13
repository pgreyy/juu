// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {MUSDash} from "../src/MUSDash.sol";
import {JuuBuffer} from "../src/JuuBuffer.sol";
import {JuuBank} from "../src/JuuBank.sol";

/// Main deployment of MUSDash v2 (MUSD, Y and P chips) with Bank v4. Uses Mezo's real PriceFeed and the main
/// Pricer. Reuses the existing main Buffer (BUFFER) and points it at the new Bank and game.
/// Run from contracts/:  set -a; source ../.env; set +a; BUFFER=0x... \
///   FOUNDRY_EVM_VERSION=osaka forge script script/DeployMUSDash.s.sol --rpc-url $MEZO_RPC_URL --broadcast --slow --gas-estimate-multiplier 150
contract DeployMUSDash is Script {
    address constant MUSD = 0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503;
    address constant MEZO_PRICE_FEED = 0x86bCF0841622a5dAC14A313a15f96A95421b9366;
    address constant BORROWER_OPERATIONS = 0xCdF7028ceAB81fA0C6971208e83fa7872994beE5;
    address constant TROVE_MANAGER = 0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0;
    address constant SPLITTER = 0xC97F652387E213a92DD2DaBDb41754CdD535ce5e;
    address constant PRICER = 0xe25F6095665626342ffF7FeA7d8BE0c40517Cf34;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        JuuBuffer buffer = JuuBuffer(vm.envAddress("BUFFER"));

        vm.startBroadcast(pk);
        JuuBank bank = new JuuBank(BORROWER_OPERATIONS, TROVE_MANAGER, MEZO_PRICE_FEED, MUSD);
        bank.setValuation(SPLITTER, PRICER);
        MUSDash game = new MUSDash(MUSD, MEZO_PRICE_FEED, address(bank), address(buffer), PRICER, SPLITTER, deployer, 1 weeks);
        bank.setGame(address(game));
        buffer.setBank(address(bank));
        buffer.setGame(address(game));
        vm.stopBroadcast();

        console.log("JuuBank", address(bank));
        console.log("MUSDash", address(game));
        console.log("JuuBuffer (reused)", address(buffer));
    }
}
