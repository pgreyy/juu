// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {JuuSplitter} from "../src/JuuSplitter.sol";
import {JuuPricer} from "../src/JuuPricer.sol";

/// Deploys JuuSplitter and JuuPricer on Mezo testnet, registers the reward sources and opens three series (10 Dec 2026, 31 Dec 2026, 25 Mar 2027).
/// Run from contracts/:  source ../.env && forge script script/DeploySplitter.s.sol --rpc-url $MEZO_RPC_URL --broadcast --slow
contract DeploySplitter is Script {
    // Mezo testnet (live earn system, checked 12 Nov 2026)
    address constant VEBTC = 0x38E35d92E6Bfc6787272A62345856B13eA12130a;
    address constant VOTER = 0x263F1Fd5fB7F866881e1B6cD7d5d6c40Fd985F0D;
    address constant REWARDS_DISTRIBUTOR = 0x9050218f89F0b5b17df4a30Ba4Fc97C72E307442;
    address constant MUSD = 0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503;
    address constant BTC = 0x7b7C000000000000000000000000000000000000;
    address constant MEZO = 0x7B7c000000000000000000000000000000000001;
    address constant PRICE_FEED = 0x86bCF0841622a5dAC14A313a15f96A95421b9366;
    address constant TROVE_MANAGER = 0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0;

    // Gauge reward contracts on the live Voter
    address constant SMUSD_FEES = 0x613F6386A6549d29a1488F5246C58cE54B128ED4;
    address constant SMUSD_BRIBE = 0x7D95237854f8Fa8F36c1280860E03736d0150BB1;
    address constant MUSD_BTC_FEES = 0x8A148DCdCC847384683c64b3BE6ADdaFd9d9Aed9;
    address constant MUSD_BTC_BRIBE = 0x75b6B35Fc78826A0B7E1f9c08bb7d84bd70D0ee1;

    uint64 constant END_DEC10_2026 = 1796860800; // Thu 10 Dec 2026 00:00 UTC, short series for the full-cycle demo
    uint64 constant END_DEC_2026 = 1798675200; // Thu 31 Dec 2026 00:00 UTC
    uint64 constant END_MAR_2027 = 1805932800; // Thu 25 Mar 2027 00:00 UTC

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        vm.startBroadcast(pk);

        JuuSplitter splitter = new JuuSplitter(VEBTC, VOTER, REWARDS_DISTRIBUTOR, 30 days, deployer);

        address[] memory t1 = new address[](1);
        t1[0] = MUSD;
        splitter.addRewardSource(SMUSD_FEES, t1);

        address[] memory t2 = new address[](2);
        t2[0] = MUSD;
        t2[1] = MEZO;
        splitter.addRewardSource(SMUSD_BRIBE, t2);

        address[] memory t3 = new address[](2);
        t3[0] = MUSD;
        t3[1] = BTC;
        splitter.addRewardSource(MUSD_BTC_FEES, t3);

        address[] memory t4 = new address[](3);
        t4[0] = MUSD;
        t4[1] = BTC;
        t4[2] = MEZO;
        splitter.addRewardSource(MUSD_BTC_BRIBE, t4);

        splitter.createSeries(END_DEC10_2026, "Juu P veBTC 10 Dec 2026", "P-veBTC-DEC10", "Juu Y veBTC 10 Dec 2026", "Y-veBTC-DEC10");
        splitter.createSeries(END_DEC_2026, "Juu P veBTC 31 Dec 2026", "P-veBTC-DEC26", "Juu Y veBTC 31 Dec 2026", "Y-veBTC-DEC26");
        splitter.createSeries(END_MAR_2027, "Juu P veBTC 25 Mar 2027", "P-veBTC-MAR27", "Juu Y veBTC 25 Mar 2027", "Y-veBTC-MAR27");

        JuuPricer pricer = new JuuPricer(PRICE_FEED, TROVE_MANAGER, address(splitter), deployer);

        vm.stopBroadcast();

        console.log("JuuSplitter", address(splitter));
        console.log("JuuPricer", address(pricer));
        for (uint256 i = 0; i < 3; i++) {
            console.log("series", i);
            console.log("  P", address(splitter.getSeries(i).p));
            console.log("  Y", address(splitter.getSeries(i).y));
        }
    }
}
