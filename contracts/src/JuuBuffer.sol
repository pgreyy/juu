// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title JuuBuffer
/// @notice The safety jar under MUSDash. A slice of trading fees and liquidation penalties fills it (plain MUSD
///         transfers from MUSDash). It pays bad debt first: when a collapsed position lost more than its margin,
///         the Buffer pays the gap to the Bank.
///         Every epoch, the jackpot contract may pay out the surplus above the Buffer's target size.
contract JuuBuffer is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable musd;
    address public bank;
    address public game;
    address public jackpot;

    event BadDebtCovered(uint256 asked, uint256 paid);
    event GameSet(address game);
    event BankSet(address bank);
    event JackpotSet(address jackpot);
    event JackpotPaid(address indexed to, uint256 amount);

    error NotGame();
    error NotJackpot();

    constructor(address musd_, address bank_) Ownable(msg.sender) {
        musd = IERC20(musd_);
        bank = bank_;
    }

    function setGame(address game_) external onlyOwner {
        game = game_;
        emit GameSet(game_);
    }

    function setJackpot(address jackpot_) external onlyOwner {
        jackpot = jackpot_;
        emit JackpotSet(jackpot_);
    }

    /// @notice The jackpot contract pays a winner from the surplus.
    function payJackpot(address to, uint256 amount) external {
        if (msg.sender != jackpot) revert NotJackpot();
        musd.safeTransfer(to, amount);
        emit JackpotPaid(to, amount);
    }

    function setBank(address bank_) external onlyOwner {
        bank = bank_;
        emit BankSet(bank_);
    }

    /// @notice MUSD in the jar.
    function balance() public view returns (uint256) {
        return musd.balanceOf(address(this));
    }

    /// @notice Pay up to `amount` of bad debt to the Bank. Returns what was paid; the Bank absorbs any rest.
    function coverBadDebt(uint256 amount) external returns (uint256 paid) {
        if (msg.sender != game) revert NotGame();
        uint256 bal = balance();
        paid = amount < bal ? amount : bal;
        if (paid > 0) musd.safeTransfer(bank, paid);
        emit BadDebtCovered(amount, paid);
    }
}
