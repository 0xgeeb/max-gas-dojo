// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { Test } from "../lib/forge-std/src/Test.sol";
import { MaxGasDojoEscrow } from "../src/MaxGasDojoEscrow.sol";
import { MGD } from "../src/MGD.sol";

contract MaxGasDojoEscrowTest is Test {
    MaxGasDojoEscrow public escrow;
    MGD public token;

    address public player = makeAddr("player");
    address public opponent = makeAddr("opponent");
    address public resolver = makeAddr("resolver");
    address public feeCollector = makeAddr("feeCollector");
    address public random = makeAddr("random");

    uint256 public constant WAGER = 100e18;
    uint256 public constant MINT_AMOUNT = 10000e18;

    function setUp() public {
        token = new MGD();
        escrow = new MaxGasDojoEscrow(address(token), resolver, feeCollector);

        token.mint(player, MINT_AMOUNT);
        token.mint(opponent, MINT_AMOUNT);

        vm.prank(player);
        token.approve(address(escrow), type(uint256).max);

        vm.prank(opponent);
        token.approve(address(escrow), type(uint256).max);
    }

    function testConstructor() public view {
        assertEq(escrow.mgd(), address(token));
        assertEq(escrow.resolver(), resolver);
        assertEq(escrow.feeCollector(), feeCollector);
    }

    function testCreateMatch() public {
        vm.prank(player);
        escrow.createMatch(opponent, WAGER);

        (
            uint256 id,
            address matchPlayer,
            address matchOpponent,
            uint256 wager,
            bool accepted,
            bool resolved,
            bool cancelled,
            address winner
        ) = escrow.matches(1);

        assertEq(id, 1);
        assertEq(matchPlayer, player);
        assertEq(matchOpponent, opponent);
        assertEq(wager, WAGER);
        assertEq(accepted, false);
        assertEq(resolved, false);
        assertEq(cancelled, false);
        assertEq(winner, address(0));
        assertEq(token.balanceOf(address(escrow)), WAGER);
        assertEq(token.balanceOf(player), MINT_AMOUNT - WAGER);
    }

    function testCreateMatchEmitsEvent() public {
        vm.expectEmit(true, true, true, true);
        emit MaxGasDojoEscrow.MatchCreated(1, player, opponent, WAGER);

        vm.prank(player);
        escrow.createMatch(opponent, WAGER);
    }

    function testCreateMultipleMatches() public {
        vm.prank(player);
        escrow.createMatch(opponent, WAGER);

        vm.prank(opponent);
        escrow.createMatch(player, WAGER * 2);

        assertEq(escrow.matchID(), 2);
        assertEq(token.balanceOf(address(escrow)), WAGER + WAGER * 2);
    }

    function testAcceptMatch() public {
        vm.prank(player);
        escrow.createMatch(opponent, WAGER);

        vm.prank(opponent);
        escrow.acceptMatch(1);

        (,,,, bool accepted,,,) = escrow.matches(1);

        assertEq(accepted, true);
        assertEq(token.balanceOf(address(escrow)), WAGER * 2);
        assertEq(token.balanceOf(opponent), MINT_AMOUNT - WAGER);
    }

    function testAcceptMatchEmitsEvent() public {
        vm.prank(player);
        escrow.createMatch(opponent, WAGER);

        vm.expectEmit(true, true, true, true);
        emit MaxGasDojoEscrow.MatchAccepted(1, player, opponent, WAGER);

        vm.prank(opponent);
        escrow.acceptMatch(1);
    }

    function testAcceptMatchRevertNotOpponent() public {
        vm.prank(player);
        escrow.createMatch(opponent, WAGER);

        vm.expectRevert(MaxGasDojoEscrow.NotOpponent.selector);
        vm.prank(random);
        escrow.acceptMatch(1);
    }

    function testAcceptMatchRevertAlreadyAccepted() public {
        vm.prank(player);
        escrow.createMatch(opponent, WAGER);

        vm.prank(opponent);
        escrow.acceptMatch(1);

        vm.expectRevert(MaxGasDojoEscrow.InvalidMatchState.selector);
        vm.prank(opponent);
        escrow.acceptMatch(1);
    }

    function testAcceptMatchRevertResolved() public {
        vm.prank(player);
        escrow.createMatch(opponent, WAGER);

        vm.prank(opponent);
        escrow.acceptMatch(1);

        vm.prank(resolver);
        escrow.resolveMatch(1, player);

        vm.expectRevert(MaxGasDojoEscrow.InvalidMatchState.selector);
        vm.prank(opponent);
        escrow.acceptMatch(1);
    }

    function testAcceptMatchRevertCancelled() public {
        vm.prank(player);
        escrow.createMatch(opponent, WAGER);

        vm.prank(player);
        escrow.cancelMatch(1);

        vm.expectRevert(MaxGasDojoEscrow.InvalidMatchState.selector);
        vm.prank(opponent);
        escrow.acceptMatch(1);
    }

    function testResolveMatch() public {
        vm.prank(player);
        escrow.createMatch(opponent, WAGER);

        vm.prank(opponent);
        escrow.acceptMatch(1);

        uint256 totalWager = WAGER * 2;
        uint256 fee = totalWager * 5 / 100;
        uint256 winnings = totalWager - fee;

        vm.prank(resolver);
        escrow.resolveMatch(1, player);

        (,,,,, bool resolved,, address winner) = escrow.matches(1);

        assertEq(resolved, true);
        assertEq(winner, player);
        assertEq(token.balanceOf(player), MINT_AMOUNT - WAGER + winnings);
        assertEq(token.balanceOf(feeCollector), fee);
        assertEq(token.balanceOf(address(escrow)), 0);
    }

    function testResolveMatchOpponentWins() public {
        vm.prank(player);
        escrow.createMatch(opponent, WAGER);

        vm.prank(opponent);
        escrow.acceptMatch(1);

        uint256 totalWager = WAGER * 2;
        uint256 fee = totalWager * 5 / 100;
        uint256 winnings = totalWager - fee;

        vm.prank(resolver);
        escrow.resolveMatch(1, opponent);

        (,,,,, bool resolved,, address winner) = escrow.matches(1);

        assertEq(resolved, true);
        assertEq(winner, opponent);
        assertEq(token.balanceOf(opponent), MINT_AMOUNT - WAGER + winnings);
        assertEq(token.balanceOf(feeCollector), fee);
    }

    function testResolveMatchEmitsEvent() public {
        vm.prank(player);
        escrow.createMatch(opponent, WAGER);

        vm.prank(opponent);
        escrow.acceptMatch(1);

        vm.expectEmit(true, true, true, true);
        emit MaxGasDojoEscrow.MatchResolved(1, player, opponent, WAGER, player);

        vm.prank(resolver);
        escrow.resolveMatch(1, player);
    }

    function testResolveMatchRevertNotResolver() public {
        vm.prank(player);
        escrow.createMatch(opponent, WAGER);

        vm.prank(opponent);
        escrow.acceptMatch(1);

        vm.expectRevert(MaxGasDojoEscrow.NotResolver.selector);
        vm.prank(random);
        escrow.resolveMatch(1, player);
    }

    function testResolveMatchRevertNotAccepted() public {
        vm.prank(player);
        escrow.createMatch(opponent, WAGER);

        vm.expectRevert(MaxGasDojoEscrow.InvalidMatchState.selector);
        vm.prank(resolver);
        escrow.resolveMatch(1, player);
    }

    function testResolveMatchRevertAlreadyResolved() public {
        vm.prank(player);
        escrow.createMatch(opponent, WAGER);

        vm.prank(opponent);
        escrow.acceptMatch(1);

        vm.prank(resolver);
        escrow.resolveMatch(1, player);

        vm.expectRevert(MaxGasDojoEscrow.InvalidMatchState.selector);
        vm.prank(resolver);
        escrow.resolveMatch(1, player);
    }

    function testResolveMatchRevertCancelled() public {
        vm.prank(player);
        escrow.createMatch(opponent, WAGER);

        vm.prank(player);
        escrow.cancelMatch(1);

        vm.expectRevert(MaxGasDojoEscrow.InvalidMatchState.selector);
        vm.prank(resolver);
        escrow.resolveMatch(1, player);
    }

    function testResolveMatchRevertInvalidWinner() public {
        vm.prank(player);
        escrow.createMatch(opponent, WAGER);

        vm.prank(opponent);
        escrow.acceptMatch(1);

        vm.expectRevert(MaxGasDojoEscrow.InvalidWinner.selector);
        vm.prank(resolver);
        escrow.resolveMatch(1, random);
    }

    function testCancelMatch() public {
        vm.prank(player);
        escrow.createMatch(opponent, WAGER);

        vm.prank(player);
        escrow.cancelMatch(1);

        (,,,,, bool resolved, bool cancelled,) = escrow.matches(1);

        assertEq(cancelled, true);
        assertEq(resolved, false);
        assertEq(token.balanceOf(player), MINT_AMOUNT);
        assertEq(token.balanceOf(address(escrow)), 0);
    }

    function testCancelMatchEmitsEvent() public {
        vm.prank(player);
        escrow.createMatch(opponent, WAGER);

        vm.expectEmit(true, true, true, true);
        emit MaxGasDojoEscrow.MatchCancelled(1, player, opponent, WAGER);

        vm.prank(player);
        escrow.cancelMatch(1);
    }

    function testCancelMatchRevertNotPlayer() public {
        vm.prank(player);
        escrow.createMatch(opponent, WAGER);

        vm.expectRevert(MaxGasDojoEscrow.NotPlayer.selector);
        vm.prank(opponent);
        escrow.cancelMatch(1);
    }

    function testCancelMatchRevertAccepted() public {
        vm.prank(player);
        escrow.createMatch(opponent, WAGER);

        vm.prank(opponent);
        escrow.acceptMatch(1);

        vm.expectRevert(MaxGasDojoEscrow.InvalidMatchState.selector);
        vm.prank(player);
        escrow.cancelMatch(1);
    }

    function testCancelMatchRevertResolved() public {
        vm.prank(player);
        escrow.createMatch(opponent, WAGER);

        vm.prank(opponent);
        escrow.acceptMatch(1);

        vm.prank(resolver);
        escrow.resolveMatch(1, player);

        vm.expectRevert(MaxGasDojoEscrow.InvalidMatchState.selector);
        vm.prank(player);
        escrow.cancelMatch(1);
    }

    function testCancelMatchRevertAlreadyCancelled() public {
        vm.prank(player);
        escrow.createMatch(opponent, WAGER);

        vm.prank(player);
        escrow.cancelMatch(1);

        vm.expectRevert(MaxGasDojoEscrow.InvalidMatchState.selector);
        vm.prank(player);
        escrow.cancelMatch(1);
    }

    function testFuzzCreateMatch(uint256 wager) public {
        vm.assume(wager > 0 && wager <= MINT_AMOUNT);

        vm.prank(player);
        escrow.createMatch(opponent, wager);

        (,, address matchOpponent, uint256 matchWager,,,, ) = escrow.matches(1);

        assertEq(matchOpponent, opponent);
        assertEq(matchWager, wager);
        assertEq(token.balanceOf(address(escrow)), wager);
    }

    function testFuzzResolveMatchFeeCalculation(uint256 wager) public {
        vm.assume(wager > 100 && wager <= 5000e18);

        vm.prank(player);
        escrow.createMatch(opponent, wager);

        vm.prank(opponent);
        escrow.acceptMatch(1);

        uint256 totalWager = wager * 2;
        uint256 fee = totalWager * 5 / 100;
        uint256 winnings = totalWager - fee;

        vm.prank(resolver);
        escrow.resolveMatch(1, player);

        assertEq(token.balanceOf(player), MINT_AMOUNT - wager + winnings);
        assertEq(token.balanceOf(feeCollector), fee);
    }

    function testCreateMatchRevertZeroWager() public {
        vm.expectRevert(MaxGasDojoEscrow.InvalidWager.selector);
        vm.prank(player);
        escrow.createMatch(opponent, 0);
    }

    function testResolveMatchDraw() public {
        vm.prank(player);
        escrow.createMatch(opponent, WAGER);

        vm.prank(opponent);
        escrow.acceptMatch(1);

        vm.prank(resolver);
        escrow.resolveMatch(1, address(0));

        (,,,,, bool resolved,, address winner) = escrow.matches(1);

        assertEq(resolved, true);
        assertEq(winner, address(0));
        assertEq(token.balanceOf(player), MINT_AMOUNT);
        assertEq(token.balanceOf(opponent), MINT_AMOUNT);
        assertEq(token.balanceOf(feeCollector), 0);
        assertEq(token.balanceOf(address(escrow)), 0);
    }

    function testResolveMatchDrawEmitsEvent() public {
        vm.prank(player);
        escrow.createMatch(opponent, WAGER);

        vm.prank(opponent);
        escrow.acceptMatch(1);

        vm.expectEmit(true, true, true, true);
        emit MaxGasDojoEscrow.MatchResolved(1, player, opponent, WAGER, address(0));

        vm.prank(resolver);
        escrow.resolveMatch(1, address(0));
    }
}
