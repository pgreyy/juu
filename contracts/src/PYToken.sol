// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface IYieldHook {
    function onYTransfer(uint256 seriesId, address from, address to) external;
}

/// @title PYToken
/// @notice A P (principal) or Y (yield) token for one Juu series. Plain ERC-20.
///         Only the splitter that created it can mint or burn.
///         A Y token tells the splitter before every balance change, so earned yield
///         is booked to the old holder before the tokens move.
contract PYToken is ERC20 {
    address public immutable splitter;
    uint256 public immutable seriesId;
    bool public immutable isYield;

    error OnlySplitter();

    constructor(string memory name_, string memory symbol_, uint256 seriesId_, bool isYield_) ERC20(name_, symbol_) {
        splitter = msg.sender;
        seriesId = seriesId_;
        isYield = isYield_;
    }

    modifier onlySplitter() {
        if (msg.sender != splitter) revert OnlySplitter();
        _;
    }

    function mint(address to, uint256 amount) external onlySplitter {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlySplitter {
        _burn(from, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (isYield) IYieldHook(splitter).onYTransfer(seriesId, from, to);
        super._update(from, to, value);
    }
}
