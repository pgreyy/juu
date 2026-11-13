// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice The parts of Mezo's veBTC (tigris VotingEscrow) that Juu calls.
interface IVotingEscrow {
    struct LockedBalance {
        int128 amount;
        uint256 end;
        bool isPermanent;
    }

    function token() external view returns (address);
    function locked(uint256 tokenId) external view returns (LockedBalance memory);
    function escrowType(uint256 tokenId) external view returns (uint8); // 0 = NORMAL
    function voted(uint256 tokenId) external view returns (bool);
    function ownerOf(uint256 tokenId) external view returns (address);
    /// @dev The live testnet veBTC names this votingPowerOfNFT (the tigris repo source says balanceOfNFT).
    function votingPowerOfNFT(uint256 tokenId) external view returns (uint256);

    function transferFrom(address from, address to, uint256 tokenId) external;
    function createLock(uint256 value, uint256 lockDuration) external returns (uint256);
    function increaseAmount(uint256 tokenId, uint256 value) external;
    function lockPermanent(uint256 tokenId) external;
    function unlockPermanent(uint256 tokenId) external;
    function merge(uint256 from, uint256 to) external;
    function withdraw(uint256 tokenId) external;
}

/// @notice The parts of Mezo's gauge Voter that Juu calls.
interface IVoter {
    function vote(uint256 tokenId, address[] calldata pools, uint256[] calldata weights) external;
    function reset(uint256 tokenId) external;
    function poke(uint256 tokenId) external;
    function claimFees(address[] memory rewards, address[][] memory tokens, uint256 tokenId) external;
    function gauges(address pool) external view returns (address);
    function gaugeToFees(address gauge) external view returns (address);
    function gaugeToBribe(address gauge) external view returns (address);
}

/// @notice Mezo's veBTC RewardsDistributor (weekly BTC rebase).
interface IRewardsDistributor {
    function claim(uint256 tokenId) external returns (uint256);
    function claimable(uint256 tokenId) external view returns (uint256);
}

/// @notice MUSD PriceFeed: BTC price in USD with 18 decimals. Reverts if Mezo's oracle is older than 60 s.
interface IPriceFeed {
    function fetchPrice() external view returns (uint256);
}

/// @notice The parts of MUSD's TroveManager that Juu reads.
interface ITroveManager {
    function getTroveStatus(address borrower) external view returns (uint8); // 1 = active
    function getTroveMaxBorrowingCapacity(address borrower) external view returns (uint256);
    function getTCR(uint256 price) external view returns (uint256);
    function getCurrentICR(address borrower, uint256 price) external view returns (uint256);
    function getEntireDebtAndColl(address borrower)
        external
        view
        returns (
            uint256 coll,
            uint256 principal,
            uint256 interest,
            uint256 pendingCollateral,
            uint256 pendingPrincipal,
            uint256 pendingInterest
        );
}

/// @notice The parts of MUSD's BorrowerOperations that Juu calls. A trove belongs to msg.sender.
///         Hints can be address(0); Mezo then searches the sorted list itself.
interface IBorrowerOperations {
    function openTrove(uint256 debtAmount, address upperHint, address lowerHint) external payable;
    function addColl(address upperHint, address lowerHint) external payable;
    function withdrawColl(uint256 amount, address upperHint, address lowerHint) external;
    function withdrawMUSD(uint256 amount, address upperHint, address lowerHint) external;
    function repayMUSD(uint256 amount, address upperHint, address lowerHint) external;
    function closeTrove() external;
    function refinance(address upperHint, address lowerHint) external;
    function minNetDebt() external view returns (uint256);
    function getBorrowingFee(uint256 debt) external view returns (uint256);
}

/// @notice Mezo DEX Router (tigris, Velodrome style).
interface IRouter {
    struct Route {
        address from;
        address to;
        bool stable;
        address factory;
    }

    function getAmountsOut(uint256 amountIn, Route[] memory routes) external view returns (uint256[] memory amounts);
    function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, Route[] calldata routes, address to, uint256 deadline)
        external
        returns (uint256[] memory amounts);
}

/// @notice Mezo DEX PoolFactory.
interface IPoolFactory {
    function getPool(address tokenA, address tokenB, bool stable) external view returns (address);
    function createPool(address tokenA, address tokenB, bool stable) external returns (address);
}

/// @notice Mezo DEX pool.
interface IPool {
    function getReserves() external view returns (uint256 reserve0, uint256 reserve1, uint256 blockTimestampLast);
    function token0() external view returns (address);
}

/// @notice MUSD Savings Rate (sMUSD) on Mezo testnet: 1 sMUSD per MUSD, yield claimed separately.
interface IMUSDSavingsRate {
    function deposit(uint256 amount) external;
    function withdraw(uint256 amount) external;
    function claimYield() external returns (uint256);
    function claimableYield(address account) external view returns (uint256);
    function yieldIndex() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
}
