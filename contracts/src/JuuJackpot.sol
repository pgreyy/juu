// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IMUSDashTickets {
    function epochLength() external view returns (uint256);
    function epochSealed(uint256 epoch) external view returns (bool);
    function sealBlock(uint256 epoch) external view returns (uint256);
    function totalTickets(uint256 epoch) external view returns (uint256);
    function findTicket(uint256 epoch, uint256 r) external view returns (address owner, uint256 positionId);
    function openInterest(uint256 side) external view returns (uint256);
}

interface IJuuBufferJackpot {
    function balance() external view returns (uint256);
    function payJackpot(address to, uint256 amount) external;
}

interface IAgentGatewayLookup {
    function positionUser(uint256 positionId) external view returns (address);
}

/// @title JuuJackpot
/// @notice Weekly (per epoch) jackpot from the Buffer's surplus above its target (5% of all open positions).
///         Tickets = position size x time held that epoch, recorded by MUSDash.
///
/// Draw (commit and reveal):
///   1. Before the epoch ends, the keeper commits keccak256(secret).
///   2. After it ends, anyone seals the epoch's tickets in MUSDash (checkpoint).
///   3. The keeper reveals the secret within 256 blocks of the seal. The winning ticket is
///      keccak256(secret, blockhash(seal block + 1)) modulo the epoch's tickets, so neither the keeper (who could
///      not know that block hash when committing) nor block producers (who don't know the secret) pick it alone.
/// The winner is the ticket's position owner; for positions held by the Agent Gateway, the user behind it.
contract JuuJackpot is Ownable, ReentrancyGuard {
    IMUSDashTickets public immutable game;
    IJuuBufferJackpot public immutable buffer;
    address public keeper;
    address public agentGateway;
    uint256 public targetShare = 0.05e18; // Buffer target = 5% of open positions

    mapping(uint256 => bytes32) public commitOf;
    mapping(uint256 => bool) public drawn;
    mapping(uint256 => address) public winnerOf;
    mapping(uint256 => uint256) public prizeOf;

    event Committed(uint256 indexed epoch, bytes32 hash);
    event Drawn(uint256 indexed epoch, address indexed winner, uint256 positionId, uint256 ticket, uint256 totalTickets, uint256 prize);
    event Skipped(uint256 indexed epoch, string reason);
    event SettingsChanged();

    error NotKeeper();
    error EpochOver();
    error AlreadyCommitted();
    error NotSealed();
    error TooEarly();
    error TooLate();
    error BadSecret();
    error AlreadyDrawn();

    constructor(address game_, address buffer_, address keeper_) Ownable(msg.sender) {
        game = IMUSDashTickets(game_);
        buffer = IJuuBufferJackpot(buffer_);
        keeper = keeper_;
    }

    function setKeeper(address keeper_) external onlyOwner {
        keeper = keeper_;
        emit SettingsChanged();
    }

    function setAgentGateway(address gateway) external onlyOwner {
        agentGateway = gateway;
        emit SettingsChanged();
    }

    function setTargetShare(uint256 share) external onlyOwner {
        targetShare = share;
        emit SettingsChanged();
    }

    /// @notice Buffer target now: 5% of all open position size.
    function target() public view returns (uint256) {
        return ((game.openInterest(0) + game.openInterest(1)) * targetShare) / 1e18;
    }

    /// @notice What the jackpot would pay right now.
    function surplus() public view returns (uint256) {
        uint256 bal = buffer.balance();
        uint256 t = target();
        return bal > t ? bal - t : 0;
    }

    /// @notice Keeper commits to a secret for `epoch` before the epoch ends.
    function commit(uint256 epoch, bytes32 hash) external {
        if (msg.sender != keeper && msg.sender != owner()) revert NotKeeper();
        if (block.timestamp >= (epoch + 1) * game.epochLength()) revert EpochOver();
        if (commitOf[epoch] != bytes32(0)) revert AlreadyCommitted();
        commitOf[epoch] = hash;
        emit Committed(epoch, hash);
    }

    /// @notice Reveal the secret after the epoch is sealed and draw the winner. Anyone holding the secret can call.
    function reveal(uint256 epoch, bytes32 secret) external nonReentrant {
        if (drawn[epoch]) revert AlreadyDrawn();
        if (keccak256(abi.encodePacked(secret)) != commitOf[epoch]) revert BadSecret();
        if (!game.epochSealed(epoch)) revert NotSealed();
        uint256 sb = game.sealBlock(epoch);
        if (block.number <= sb + 1) revert TooEarly();
        if (block.number > sb + 256) revert TooLate();
        drawn[epoch] = true;

        uint256 total = game.totalTickets(epoch);
        uint256 prize = surplus();
        if (total == 0 || prize == 0) {
            emit Skipped(epoch, total == 0 ? "no tickets" : "no surplus");
            return;
        }
        uint256 r = uint256(keccak256(abi.encodePacked(secret, blockhash(sb + 1)))) % total;
        (address owner_, uint256 positionId) = game.findTicket(epoch, r);
        address winner = owner_;
        if (owner_ == agentGateway && agentGateway != address(0)) winner = IAgentGatewayLookup(agentGateway).positionUser(positionId);
        winnerOf[epoch] = winner;
        prizeOf[epoch] = prize;
        buffer.payJackpot(winner, prize);
        emit Drawn(epoch, winner, positionId, r, total, prize);
    }

    /// @notice If the reveal window was missed, mark the epoch skipped; its surplus stays for the next draw.
    function skip(uint256 epoch) external {
        if (drawn[epoch]) revert AlreadyDrawn();
        if (!game.epochSealed(epoch)) revert NotSealed();
        if (block.number <= game.sealBlock(epoch) + 256 && commitOf[epoch] != bytes32(0)) revert TooEarly();
        drawn[epoch] = true;
        emit Skipped(epoch, "reveal window missed or no commit");
    }
}
