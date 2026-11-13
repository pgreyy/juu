// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IRouter, IPoolFactory, IPool} from "./interfaces/IMezo.sol";
import {JuuSplitter} from "./JuuSplitter.sol";

/// @title JuuPMarket
/// @notice The P Market: one P/BTC pool per series on Mezo's own DEX. This helper creates the pools, quotes P's
///         price and the fixed return it implies, and lets people buy or sell P with plain BTC through Mezo's
///         Router. P's price moves toward 1 BTC as the end date nears, because each P is redeemable for 1 BTC then.
contract JuuPMarket is ReentrancyGuard {
    using SafeERC20 for IERC20;

    JuuSplitter public immutable splitter;
    IRouter public immutable router;
    IPoolFactory public immutable factory;
    IERC20 public immutable btc;

    event PoolCreated(uint256 indexed seriesId, address pool);
    event BoughtP(uint256 indexed seriesId, address indexed buyer, uint256 btcIn, uint256 pOut);
    event SoldP(uint256 indexed seriesId, address indexed seller, uint256 pIn, uint256 btcOut);

    error NoPool();

    constructor(address splitter_, address router_, address factory_) {
        splitter = JuuSplitter(payable(splitter_));
        router = IRouter(router_);
        factory = IPoolFactory(factory_);
        btc = splitter.btc();
    }

    function pToken(uint256 seriesId) public view returns (address) {
        return address(splitter.getSeries(seriesId).p);
    }

    /// @notice Create the series' P/BTC pool on Mezo's DEX (volatile pool). Anyone can call.
    function createPool(uint256 seriesId) external returns (address pool) {
        address p = pToken(seriesId);
        pool = factory.getPool(p, address(btc), false);
        if (pool == address(0)) {
            pool = factory.createPool(p, address(btc), false);
            emit PoolCreated(seriesId, pool);
        }
    }

    function poolOf(uint256 seriesId) public view returns (address) {
        return factory.getPool(pToken(seriesId), address(btc), false);
    }

    /// @notice BTC per P from the pool's reserves (1e18 = 1 BTC). 0 without liquidity.
    function priceOfP(uint256 seriesId) public view returns (uint256) {
        address pool = poolOf(seriesId);
        if (pool == address(0)) return 0;
        (uint256 r0, uint256 r1,) = IPool(pool).getReserves();
        (uint256 rP, uint256 rB) = IPool(pool).token0() == pToken(seriesId) ? (r0, r1) : (r1, r0);
        if (rP == 0) return 0;
        return (rB * 1e18) / rP;
    }

    /// @notice Fixed return for buying at the pool price and holding to the end date (1e18 = 100%), and seconds left.
    function impliedReturn(uint256 seriesId) external view returns (uint256 fixedReturn, uint256 secondsLeft) {
        uint256 price = priceOfP(seriesId);
        if (price == 0 || price >= 1e18) return (0, 0);
        fixedReturn = ((1e18 - price) * 1e18) / price;
        uint256 end = splitter.getSeries(seriesId).end;
        secondsLeft = end > block.timestamp ? end - block.timestamp : 0;
    }

    function quoteBuy(uint256 seriesId, uint256 btcIn) external view returns (uint256 pOut) {
        return router.getAmountsOut(btcIn, _route(address(btc), pToken(seriesId)))[1];
    }

    /// @notice Buy P with plain BTC.
    function buyP(uint256 seriesId, uint256 minPOut) external payable nonReentrant returns (uint256 pOut) {
        if (poolOf(seriesId) == address(0)) revert NoPool();
        btc.forceApprove(address(router), msg.value);
        uint256[] memory out = router.swapExactTokensForTokens(msg.value, minPOut, _route(address(btc), pToken(seriesId)), msg.sender, block.timestamp);
        pOut = out[1];
        emit BoughtP(seriesId, msg.sender, msg.value, pOut);
    }

    /// @notice Sell P for BTC (approve this contract for the P first).
    function sellP(uint256 seriesId, uint256 amount, uint256 minBtcOut) external nonReentrant returns (uint256 btcOut) {
        if (poolOf(seriesId) == address(0)) revert NoPool();
        IERC20 p = IERC20(pToken(seriesId));
        p.safeTransferFrom(msg.sender, address(this), amount);
        p.forceApprove(address(router), amount);
        uint256[] memory out = router.swapExactTokensForTokens(amount, minBtcOut, _route(address(p), address(btc)), msg.sender, block.timestamp);
        btcOut = out[1];
        emit SoldP(seriesId, msg.sender, amount, btcOut);
    }

    function _route(address from, address to) internal view returns (IRouter.Route[] memory r) {
        r = new IRouter.Route[](1);
        r[0] = IRouter.Route(from, to, false, address(factory));
    }
}
