// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { ERC20 } from "../lib/solady/src/tokens/ERC20.sol";

contract MGD is ERC20 {

  function name() public pure override returns (string memory) {
    return "Max Gas Dojo Token";
  }

  function symbol() public pure override returns (string memory) {
    return "MGD";
  }

  function mint(address _to, uint256 _amount) external {
    _mint(_to, _amount);
  }

  function burn(address _to, uint256 _amount) external {
    _burn(_to, _amount);
  }
}