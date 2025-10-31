// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

contract WizardsCentralEscrow {

    struct Match {
        address player;
        address opponent;
        uint256 bet;
        bool accepted;
        bool resolved;
        address winner;
    }

    error NotServer();
    error NotOpponent();
    error InvalidMatchState();

    address public server;
    address public wc;

    uint256 matchID;

    mapping(uint256 => Match) public matches;

    function createMatch(address opponent, uint256 bet) external {
        // SafeTransferLib.safeTransferFrom(wc, msg.sender, address(this), bet);
        Match memory newMatch = Match({
            player: msg.sender,
            opponent: opponent,
            bet: bet,
            accepted: false,
            resolved: false,
            winner: address(0)
        });
        matches[matchID++] = newMatch;
    }

    function acceptMatch(uint256 id) external {
        Match storage matchToAccept = matches[id];
        if(matchToAccept.accepted || matchToAccept.resolved) revert InvalidMatchState();
        if(msg.sender != matchToAccept.opponent) revert NotOpponent();
        // SafeTransferLib.safeTransferFrom(wc, msg.sender, address(this), bet);
        matchToAccept.accepted = true;
    }

    function resolveMatch(uint256 id, address winner) external {
        if(msg.sender != server) revert NotServer();
        Match storage matchToResolve = matches[id];
        if(!matchToResolve.accepted || matchToResolve.resolved) revert InvalidMatchState();
        if(winner != matchToResolve.player && winner != matchToResolve.opponent) revert NotOpponent();
        matchToResolve.winner = winner;
        matchToResolve.resolved = true;
        // SafeTransferLib.safeTransfer(wc, winner, matchToResolve.bet * 2);
    }
}