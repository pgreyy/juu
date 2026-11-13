// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IPriceFeed} from "../interfaces/IMezo.sol";

/// @title DemoPriceFeed (DEMO ONLY)
/// @notice DEMO ONLY. Used only by the separate, clearly labelled demo deployment of MUSDash, never by the main
///         contracts. It returns Mezo's real BTC price unless the owner has set a demo price, so a demo can show a
///         floor collapsing without waiting for the market.
contract DemoPriceFeed is IPriceFeed, Ownable {
    string public constant WARNING = "DEMO ONLY: the owner can set this price. Not used by Juu's main contracts.";

    IPriceFeed public immutable mezoPriceFeed;
    uint256 public demoPrice; // 0 = follow Mezo's price

    event DemoPriceSet(uint256 price);

    constructor(address mezoPriceFeed_) Ownable(msg.sender) {
        mezoPriceFeed = IPriceFeed(mezoPriceFeed_);
    }

    /// @notice Set a demo BTC price (18 decimals), or 0 to follow Mezo's price again.
    function setDemoPrice(uint256 price) external onlyOwner {
        demoPrice = price;
        emit DemoPriceSet(price);
    }

    function fetchPrice() external view returns (uint256) {
        return demoPrice != 0 ? demoPrice : mezoPriceFeed.fetchPrice();
    }
}
