// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {MUSDash} from "../src/MUSDash.sol";
import {JuuBuffer} from "../src/JuuBuffer.sol";
import {JuuBank} from "../src/JuuBank.sol";
import {JuuJackpot} from "../src/JuuJackpot.sol";
import {JuuLoop} from "../src/JuuLoop.sol";
import {AgentGateway} from "../src/AgentGateway.sol";
import {JuuAccountFactory} from "../src/JuuAccount.sol";
import {JuuPMarket} from "../src/JuuPMarket.sol";
import {JuuSavingsSplitter} from "../src/JuuSavingsSplitter.sol";

/// Deploys the v3 game stack next to the existing Splitter, Pricer and Bank v4:
///   Buffer v2, MUSDash v3, Jackpot, Loop, Agent Gateway; main also gets the Juu account factory, P Market and the
///   sMUSD door (with the same series dates as the veBTC series).
/// STACK=main uses Mezo's PriceFeed and a 1-week epoch. STACK=demo (DEMO ONLY) uses the demo price feed, demo
/// Pricer and demo Bank, and a 15-minute epoch so the kill switch and jackpot can be shown in an hour.
/// Run from contracts/:  set -a; source ../.env; set +a; STACK=main \
///   FOUNDRY_EVM_VERSION=osaka forge script script/DeployV3.s.sol --rpc-url $MEZO_RPC_URL --broadcast --slow --gas-estimate-multiplier 150
contract DeployV3 is Script {
    address constant MUSD = 0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503;
    address constant BTC = 0x7b7C000000000000000000000000000000000000;
    address constant MEZO_PRICE_FEED = 0x86bCF0841622a5dAC14A313a15f96A95421b9366;
    address constant BORROWER_OPERATIONS = 0xCdF7028ceAB81fA0C6971208e83fa7872994beE5;
    address constant TROVE_MANAGER = 0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0;
    address constant ROUTER = 0x9a1ff7FE3a0F69959A3fBa1F1e5ee18e1A9CD7E9;
    address constant POOL_FACTORY = 0x4947243CC818b627A5D06d14C4eCe7398A23Ce1A;
    address constant SMUSD = 0x6f461c68B2c5492C0F5CCEc5a264d692aA7A8e16;
    address constant SPLITTER = 0xC97F652387E213a92DD2DaBDb41754CdD535ce5e;

    address constant MAIN_PRICER = 0xe25F6095665626342ffF7FeA7d8BE0c40517Cf34;
    address constant MAIN_BANK = 0x42428f3c928c9af20E4d10Ca1D91aBDd565c5959;
    address constant DEMO_FEED = 0x01297A4923330BC49EAA21777284b3e6440498E8;
    address constant DEMO_PRICER = 0x009BcfeC38cF0F15215E87B44fF1DF53c868A0D1;
    address constant DEMO_BANK = 0x0A2acca04fD2fEbd2BB9e6eE30762b487A51F420;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        bool demo = keccak256(bytes(vm.envString("STACK"))) == keccak256("demo");
        address feed = demo ? DEMO_FEED : MEZO_PRICE_FEED;
        address pricer = demo ? DEMO_PRICER : MAIN_PRICER;
        JuuBank bank = JuuBank(payable(demo ? DEMO_BANK : MAIN_BANK));

        vm.startBroadcast(pk);
        JuuBuffer buffer = new JuuBuffer(MUSD, address(bank));
        MUSDash game = new MUSDash(MUSD, feed, address(bank), address(buffer), pricer, SPLITTER, deployer, demo ? 15 minutes : 1 weeks);
        JuuJackpot jackpot = new JuuJackpot(address(game), address(buffer), deployer);
        JuuLoop loop = new JuuLoop(SPLITTER, ROUTER, feed, MUSD, POOL_FACTORY);
        AgentGateway gateway = new AgentGateway(address(game), address(buffer), address(bank));

        buffer.setGame(address(game));
        buffer.setJackpot(address(jackpot));
        bank.setGame(address(game));
        game.setLoop(address(loop));
        loop.setCaller(address(game), true);
        loop.setCaller(address(gateway), true);
        gateway.setLoop(address(loop));
        jackpot.setAgentGateway(address(gateway));

        if (!demo) {
            JuuAccountFactory factory = new JuuAccountFactory(
                BORROWER_OPERATIONS, TROVE_MANAGER, MEZO_PRICE_FEED, MUSD, BTC, address(game), ROUTER, POOL_FACTORY
            );
            JuuPMarket pmarket = new JuuPMarket(SPLITTER, ROUTER, POOL_FACTORY);
            JuuSavingsSplitter savings = new JuuSavingsSplitter(SMUSD, MUSD);
            savings.createSeries(1796860800, "Juu P sMUSD 10 Dec 2026", "P-sMUSD-DEC10", "Juu Y sMUSD 10 Dec 2026", "Y-sMUSD-DEC10");
            savings.createSeries(1798675200, "Juu P sMUSD 31 Dec 2026", "P-sMUSD-DEC26", "Juu Y sMUSD 31 Dec 2026", "Y-sMUSD-DEC26");
            savings.createSeries(1805932800, "Juu P sMUSD 25 Mar 2027", "P-sMUSD-MAR27", "Juu Y sMUSD 25 Mar 2027", "Y-sMUSD-MAR27");
            console.log("JuuAccountFactory", address(factory));
            console.log("JuuPMarket", address(pmarket));
            console.log("JuuSavingsSplitter", address(savings));
        }
        vm.stopBroadcast();

        console.log(demo ? "DEMO stack" : "MAIN stack");
        console.log("JuuBuffer v2", address(buffer));
        console.log("MUSDash v3", address(game));
        console.log("JuuJackpot", address(jackpot));
        console.log("JuuLoop", address(loop));
        console.log("AgentGateway", address(gateway));
    }
}
