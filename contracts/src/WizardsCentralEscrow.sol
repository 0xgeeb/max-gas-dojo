// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { SafeTransferLib } from "../lib/solady/src/utils/SafeTransferLib.sol";

contract WizardsCentralEscrow {

    struct Match {
        uint256 ID;
        address player;
        address opponent;
        uint256 wager;
        bool accepted;
        bool resolved;
        bool cancelled;
        address winner;
    }

    error NotResolver();
    error NotOpponent();
    error NotPlayer();
    error InvalidMatchState();
    error InvalidWinner();
    error InvalidWager();

    event MatchCreated(uint256 matchID, address player, address opponent, uint256 wager);
    event MatchAccepted(uint256 matchID, address player, address opponent, uint256 wager);
    event MatchResolved(uint256 matchID, address player, address opponent, uint256 wager, address winner);
    event MatchCancelled(uint256 matchID, address player, address opponent, uint256 wager);

    address public wc;
    address public resolver;
    address public feeCollector;

    uint256 public matchID;

    mapping(uint256 => Match) public matches;

    constructor(
        address _wc,
        address _resolver,
        address _feeCollector
    ) {
        wc = _wc;
        resolver = _resolver;
        feeCollector = _feeCollector;
    }

    function createMatch(address opponent, uint256 wager) external {
        if(wager == 0) revert InvalidWager();
        SafeTransferLib.safeTransferFrom(wc, msg.sender, address(this), wager);
        matchID++;
        Match memory newMatch = Match({
            ID: matchID,
            player: msg.sender,
            opponent: opponent,
            wager: wager,
            accepted: false,
            resolved: false,
            cancelled: false,
            winner: address(0)
        });
        matches[matchID] = newMatch;
        emit MatchCreated(matchID, msg.sender, opponent, wager);
    }

    function acceptMatch(uint256 id) external {
        Match storage matchToAccept = matches[id];
        if(matchToAccept.accepted || matchToAccept.resolved || matchToAccept.cancelled) revert InvalidMatchState();
        if(msg.sender != matchToAccept.opponent) revert NotOpponent();
        SafeTransferLib.safeTransferFrom(wc, msg.sender, address(this), matchToAccept.wager);
        matchToAccept.accepted = true;
        emit MatchAccepted(id, matchToAccept.player, matchToAccept.opponent, matchToAccept.wager);
    }

    function resolveMatch(uint256 id, address winner) external {
        if(msg.sender != resolver) revert NotResolver();
        Match storage matchToResolve = matches[id];
        if(!matchToResolve.accepted || matchToResolve.resolved || matchToResolve.cancelled) revert InvalidMatchState();
        if(winner != address(0) && winner != matchToResolve.player && winner != matchToResolve.opponent) revert InvalidWinner();
        matchToResolve.winner = winner;
        matchToResolve.resolved = true;
        if(winner == address(0)) {
            SafeTransferLib.safeTransfer(wc, matchToResolve.player, matchToResolve.wager);
            SafeTransferLib.safeTransfer(wc, matchToResolve.opponent, matchToResolve.wager);
        } else {
            uint256 wagerWin = matchToResolve.wager * 2;
            uint256 fee = wagerWin * 5 / 100;
            SafeTransferLib.safeTransfer(wc, winner, wagerWin - fee);
            SafeTransferLib.safeTransfer(wc, feeCollector, fee);
        }
        emit MatchResolved(id, matchToResolve.player, matchToResolve.opponent, matchToResolve.wager, winner);
    }

    function cancelMatch(uint256 id) external {
        Match storage matchToCancel = matches[id];
        if(matchToCancel.accepted || matchToCancel.resolved || matchToCancel.cancelled) revert InvalidMatchState();
        if(msg.sender != matchToCancel.player) revert NotPlayer();
        matchToCancel.cancelled = true;
        SafeTransferLib.safeTransfer(wc, msg.sender, matchToCancel.wager);
        emit MatchCancelled(id, matchToCancel.player, matchToCancel.opponent, matchToCancel.wager);
    }
}