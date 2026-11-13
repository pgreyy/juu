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

/// v4 stack: Bank v5 (cash reserve) and MUSDash v4 (win cap, Bank cash check), with a new Jackpot and Agent
/// Gateway (both point at the game) and, on main, a new Juu account factory. Reuses the stack's Buffer v2 and Loop.
/// STACK=main or STACK=demo (DEMO ONLY: demo price feed and Pricer, 15-minute epochs). KEEPER = keeper wallet.
/// Run from contracts/:  set -a; source ../.env; set +a; STACK=main KEEPER=$KEEPER_ADDR \
///   FOUNDRY_EVM_VERSION=osaka forge script script/DeployV4.s.sol --rpc-url $MEZO_RPC_URL --broadcast --slow --gas-estimate-multiplier 150
contract DeployV4 is Script {
    address constant MUSD = 0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503;
    address constant BTC = 0x7b7C000000000000000000000000000000000000;
    address constant MEZO_PRICE_FEED = 0x86bCF0841622a5dAC14A313a15f96A95421b9366;
    address constant BORROWER_OPERATIONS = 0xCdF7028ceAB81fA0C6971208e83fa7872994beE5;
    address constant TROVE_MANAGER = 0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0;
    address constant ROUTER = 0x9a1ff7FE3a0F69959A3fBa1F1e5ee18e1A9CD7E9;
    address constant POOL_FACTORY = 0x4947243CC818b627A5D06d14C4eCe7398A23Ce1A;
    address constant SPLITTER = 0xC97F652387E213a92DD2DaBDb41754CdD535ce5e;

    address constant MAIN_PRICER = 0xe25F6095665626342ffF7FeA7d8BE0c40517Cf34;
    address constant MAIN_BUFFER = 0xAB61604F82f645110A062b49F2bC204cbb473d39;
    address constant MAIN_LOOP = 0x33c807030053b821B1efCEcbF40F9A7025edec28;
    address constant DEMO_FEED = 0x01297A4923330BC49EAA21777284b3e6440498E8;
    address constant DEMO_PRICER = 0x009BcfeC38cF0F15215E87B44fF1DF53c868A0D1;
    address constant DEMO_BUFFER = 0xaa07cCbd7DC5662321D0E2bc7D4CFa34a9eB62A0;
    address constant DEMO_LOOP = 0x6509684FF00DE88c0E233Ca16c2082b01Ce450a1;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address keeper = vm.envAddress("KEEPER");
        bool demo = keccak256(bytes(vm.envString("STACK"))) == keccak256("demo");
        address feed = demo ? DEMO_FEED : MEZO_PRICE_FEED;
        address pricer = demo ? DEMO_PRICER : MAIN_PRICER;
        JuuBuffer buffer = JuuBuffer(demo ? DEMO_BUFFER : MAIN_BUFFER);
        JuuLoop loop = JuuLoop(payable(demo ? DEMO_LOOP : MAIN_LOOP));

        vm.startBroadcast(pk);
        JuuBank bank = new JuuBank(BORROWER_OPERATIONS, TROVE_MANAGER, feed, MUSD);
        bank.setValuation(SPLITTER, pricer);
        MUSDash game = new MUSDash(MUSD, feed, address(bank), address(buffer), pricer, SPLITTER, deployer, demo ? 15 minutes : 1 weeks);
        JuuJackpot jackpot = new JuuJackpot(address(game), address(buffer), keeper);
        AgentGateway gateway = new AgentGateway(address(game), address(buffer), address(bank));

        bank.setGame(address(game));
        buffer.setBank(address(bank));
        buffer.setGame(address(game));
        buffer.setJackpot(address(jackpot));
        game.setLoop(address(loop));
        loop.setCaller(address(game), true);
        loop.setCaller(address(gateway), true);
        gateway.setLoop(address(loop));
        jackpot.setAgentGateway(address(gateway));

        if (!demo) {
            JuuAccountFactory factory = new JuuAccountFactory(
                BORROWER_OPERATIONS, TROVE_MANAGER, MEZO_PRICE_FEED, MUSD, BTC, address(game), ROUTER, POOL_FACTORY
            );
            console.log("JuuAccountFactory", address(factory));
        }
        vm.stopBroadcast();

        console.log(demo ? "DEMO stack" : "MAIN stack");
        console.log("JuuBank v5", address(bank));
        console.log("MUSDash v4", address(game));
        console.log("JuuJackpot", address(jackpot));
        console.log("AgentGateway", address(gateway));
    }
}
