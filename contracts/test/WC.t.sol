// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { Test } from "../lib/forge-std/src/Test.sol";
import { WC } from "../src/WC.sol";

contract WCTest is Test {
    WC public token;

    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    function setUp() public {
        token = new WC();
    }

    function testName() public view {
        assertEq(token.name(), "Wizards Central Token");
    }

    function testSymbol() public view {
        assertEq(token.symbol(), "WC");
    }

    function testDecimals() public view {
        assertEq(token.decimals(), 18);
    }

    function testMint() public {
        uint256 amount = 1000e18;
        token.mint(alice, amount);

        assertEq(token.balanceOf(alice), amount);
        assertEq(token.totalSupply(), amount);
    }

    function testMintMultipleTimes() public {
        token.mint(alice, 100e18);
        token.mint(alice, 200e18);
        token.mint(bob, 300e18);

        assertEq(token.balanceOf(alice), 300e18);
        assertEq(token.balanceOf(bob), 300e18);
        assertEq(token.totalSupply(), 600e18);
    }

    function testBurn() public {
        token.mint(alice, 1000e18);
        token.burn(alice, 300e18);

        assertEq(token.balanceOf(alice), 700e18);
        assertEq(token.totalSupply(), 700e18);
    }

    function testBurnAll() public {
        uint256 amount = 1000e18;
        token.mint(alice, amount);
        token.burn(alice, amount);

        assertEq(token.balanceOf(alice), 0);
        assertEq(token.totalSupply(), 0);
    }

    function testBurnRevertInsufficientBalance() public {
        token.mint(alice, 100e18);

        vm.expectRevert();
        token.burn(alice, 101e18);
    }

    function testTransfer() public {
        token.mint(alice, 1000e18);

        vm.prank(alice);
        token.transfer(bob, 300e18);

        assertEq(token.balanceOf(alice), 700e18);
        assertEq(token.balanceOf(bob), 300e18);
    }

    function testApprove() public {
        vm.prank(alice);
        token.approve(bob, 1000e18);

        assertEq(token.allowance(alice, bob), 1000e18);
    }

    function testTransferFrom() public {
        token.mint(alice, 1000e18);

        vm.prank(alice);
        token.approve(bob, 500e18);

        vm.prank(bob);
        token.transferFrom(alice, bob, 300e18);

        assertEq(token.balanceOf(alice), 700e18);
        assertEq(token.balanceOf(bob), 300e18);
        assertEq(token.allowance(alice, bob), 200e18);
    }

    function testFuzzMint(address to, uint256 amount) public {
        vm.assume(to != address(0));
        vm.assume(amount < type(uint256).max);

        token.mint(to, amount);

        assertEq(token.balanceOf(to), amount);
        assertEq(token.totalSupply(), amount);
    }

    function testFuzzBurn(address from, uint256 mintAmount, uint256 burnAmount) public {
        vm.assume(from != address(0));
        vm.assume(mintAmount >= burnAmount);
        vm.assume(mintAmount < type(uint256).max / 2);

        token.mint(from, mintAmount);
        token.burn(from, burnAmount);

        assertEq(token.balanceOf(from), mintAmount - burnAmount);
    }
}
