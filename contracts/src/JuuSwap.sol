// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IRouter} from "./interfaces/IMezo.sol";

/// @title JuuSwap
/// @notice The Swap tab's front door to Mezo's own basic-pool Router. One transaction: it takes the input token from the
///         user, keeps the Juu fee (0.1% of the input by default), and swaps the rest through Mezo's Router straight to
///         the user. The fee is turned into MUSD on Mezo's pools in the same transaction, then split half to the
///         safety jar (the Buffer that feeds the jackpot) and half to the Bank (its savers' share value).
///         If the fee can't be swapped (for example it is too small), it goes to the Bank as is.
/// @dev The fee rate is owner-settable with a hard cap of 0.5%, and the fee can be turned off.
contract JuuSwap is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant MAX_FEE = 0.005e18; // 0.5%, hard cap

    IRouter public immutable router;
    address public immutable factory; // Mezo's PoolFactory, for the fee's route to MUSD
    IERC20 public immutable musd;

    address public buffer; // safety jar: receives half of each fee, in MUSD
    address public bank; // Bank: receives the other half, in MUSD
    uint256 public feeRate = 0.001e18; // 0.1% of the input (1e18 = 100%)
    bool public feeOn = true;

    event Swapped(address indexed user, address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 fee, uint256 amountOut);
    event FeePaid(address indexed tokenIn, uint256 fee, uint256 toBufferMUSD, uint256 toBankMUSD, bool convertedToMUSD);
    event FeeSet(uint256 rate, bool on);
    event SinksSet(address buffer, address bank);

    error BadRoute();
    error FeeTooHigh();
    error ZeroAddress();

    constructor(address router_, address factory_, address musd_, address buffer_, address bank_) Ownable(msg.sender) {
        if (router_ == address(0) || factory_ == address(0) || musd_ == address(0) || buffer_ == address(0) || bank_ == address(0)) revert ZeroAddress();
        router = IRouter(router_);
        factory = factory_;
        musd = IERC20(musd_);
        buffer = buffer_;
        bank = bank_;
    }

    // ---------------------------------------------------------------- owner

    function setFee(uint256 rate, bool on) external onlyOwner {
        if (rate > MAX_FEE) revert FeeTooHigh();
        feeRate = rate;
        feeOn = on;
        emit FeeSet(rate, on);
    }

    function setSinks(address buffer_, address bank_) external onlyOwner {
        if (buffer_ == address(0) || bank_ == address(0)) revert ZeroAddress();
        buffer = buffer_;
        bank = bank_;
        emit SinksSet(buffer_, bank_);
    }

    // ---------------------------------------------------------------- views

    /// @notice The fee taken from `amountIn` right now.
    function feeOf(uint256 amountIn) public view returns (uint256) {
        return feeOn ? (amountIn * feeRate) / 1e18 : 0;
    }

    /// @notice What `amountIn` buys after the fee: the fee and the Router's quote for the rest.
    function quote(uint256 amountIn, IRouter.Route[] calldata routes) external view returns (uint256 fee, uint256 amountOut) {
        fee = feeOf(amountIn);
        uint256[] memory outs = router.getAmountsOut(amountIn - fee, routes);
        amountOut = outs[outs.length - 1];
    }

    // ---------------------------------------------------------------- swap

    /// @notice Swap `amountIn` of routes[0].from. Approve this contract for the input token first.
    ///         `amountOutMin` applies to what the user receives (after the fee).
    function swap(uint256 amountIn, uint256 amountOutMin, IRouter.Route[] calldata routes, address to, uint256 deadline)
        external
        nonReentrant
        returns (uint256 amountOut)
    {
        uint256 n = routes.length;
        if (n == 0) revert BadRoute();
        for (uint256 i = 1; i < n; i++) if (routes[i].from != routes[i - 1].to) revert BadRoute();
        IERC20 tokenIn = IERC20(routes[0].from);
        tokenIn.safeTransferFrom(msg.sender, address(this), amountIn);

        uint256 fee = feeOf(amountIn);
        if (fee > 0) _payFee(tokenIn, fee);

        tokenIn.forceApprove(address(router), amountIn - fee);
        uint256[] memory outs = router.swapExactTokensForTokens(amountIn - fee, amountOutMin, routes, to, deadline);
        amountOut = outs[outs.length - 1];
        emit Swapped(msg.sender, address(tokenIn), routes[n - 1].to, amountIn, fee, amountOut);
    }

    /// @dev Turns the fee into MUSD on Mezo's pool (unless it already is MUSD) and splits it between the safety jar
    ///      and the Bank. A fee that can't be swapped goes to the Bank unchanged.
    function _payFee(IERC20 tokenIn, uint256 fee) internal {
        uint256 m = fee;
        bool converted = true;
        if (address(tokenIn) != address(musd)) {
            IRouter.Route[] memory r = new IRouter.Route[](1);
            r[0] = IRouter.Route(address(tokenIn), address(musd), false, factory);
            tokenIn.forceApprove(address(router), fee);
            try router.swapExactTokensForTokens(fee, 0, r, address(this), block.timestamp) returns (uint256[] memory outs) {
                m = outs[1];
            } catch {
                tokenIn.forceApprove(address(router), 0);
                tokenIn.safeTransfer(bank, fee);
                emit FeePaid(address(tokenIn), fee, 0, 0, false);
                return;
            }
        }
        uint256 half = m / 2;
        musd.safeTransfer(buffer, half);
        musd.safeTransfer(bank, m - half);
        emit FeePaid(address(tokenIn), fee, half, m - half, converted);
    }
}
