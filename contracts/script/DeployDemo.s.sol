// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {DemoPriceFeed} from "../src/demo/DemoPriceFeed.sol";
import {JuuBank} from "../src/JuuBank.sol";
import {JuuBuffer} from "../src/JuuBuffer.sol";
import {JuuPricer} from "../src/JuuPricer.sol";
import {MUSDash} from "../src/MUSDash.sol";

/// DEMO DEPLOYMENT ONLY. A separate Pricer, Bank, Buffer and MUSDash that all read DemoPriceFeed, whose owner can
/// set the BTC price so a floor collapse can be shown on demand. Never connected to the main Juu contracts.
/// Reuses an existing DemoPriceFeed if DEMO_FEED is set, otherwise deploys one.
/// Run from contracts/:  set -a; source ../.env; set +a; DEMO_FEED=0x... \
///   FOUNDRY_EVM_VERSION=osaka forge script script/DeployDemo.s.sol --rpc-url $MEZO_RPC_URL --broadcast --slow --gas-estimate-multiplier 150
contract DeployDemo is Script {
    address constant MUSD = 0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503;
    address constant MEZO_PRICE_FEED = 0x86bCF0841622a5dAC14A313a15f96A95421b9366;
    address constant BORROWER_OPERATIONS = 0xCdF7028ceAB81fA0C6971208e83fa7872994beE5;
    address constant TROVE_MANAGER = 0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0;
    address constant SPLITTER = 0xC97F652387E213a92DD2DaBDb41754CdD535ce5e;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address feedAddr = vm.envOr("DEMO_FEED", address(0));

        vm.startBroadcast(pk);
        if (feedAddr == address(0)) feedAddr = address(new DemoPriceFeed(MEZO_PRICE_FEED));
        // Every demo contract reads the demo price, so the game, the Pricer and the Bank agree.
        JuuPricer pricer = new JuuPricer(feedAddr, TROVE_MANAGER, SPLITTER, deployer);
        JuuBank bank = new JuuBank(BORROWER_OPERATIONS, TROVE_MANAGER, feedAddr, MUSD);
        bank.setValuation(SPLITTER, address(pricer));
        JuuBuffer buffer = new JuuBuffer(MUSD, address(bank));
        MUSDash game = new MUSDash(MUSD, feedAddr, address(bank), address(buffer), address(pricer), SPLITTER, deployer, 20 minutes);
        buffer.setGame(address(game));
        bank.setGame(address(game));
        vm.stopBroadcast();

        console.log("DEMO DemoPriceFeed", feedAddr);
        console.log("DEMO JuuPricer", address(pricer));
        console.log("DEMO JuuBank", address(bank));
        console.log("DEMO JuuBuffer", address(buffer));
        console.log("DEMO MUSDash", address(game));
    }
}
