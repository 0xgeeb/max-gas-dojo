// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { Script, console } from "../lib/forge-std/src/Script.sol";
import { MGD } from "../src/MGD.sol";
import { MaxGasDojoEscrow } from "../src/MaxGasDojoEscrow.sol";

contract DeployScript is Script {

    MGD mgd;
    MaxGasDojoEscrow escrow;

    address deployer = 0x895614c89beC7D11454312f740854d08CbF57A78;
    address resolver = 0x895614c89beC7D11454312f740854d08CbF57A78;
    address feeCollector = 0x895614c89beC7D11454312f740854d08CbF57A78;

    address oldmgdaddy = 0x8016269e0c30d897f495470aC464c283bf51A77b;
    address oldescrowaddy = 0xc6f4D3Ae8443f091A9c5015041093F3c0a41956f;

    address mgdaddy = 0x1FD5270705F2F6b69a57b1eb72901031b1c46752;
    address escrowaddy = 0x186C96B9c362DBBf4D33C6dAd04127F0238F5499;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PK");
        vm.startBroadcast(deployerPrivateKey);

        _deployMGD();
        // _cancel();
        // _accept();
        // _mint();

        vm.stopBroadcast();
    }

    function _deployMGD() internal {
        mgd = new MGD();
        escrow = new MaxGasDojoEscrow(address(mgd), resolver, feeCollector);
        mgd.mint(deployer, 1_000_000e18);
    }

    function _cancel() internal {
        MaxGasDojoEscrow(escrowaddy).cancelMatch(3);
    }

    function _accept() internal {
        MaxGasDojoEscrow(escrowaddy).acceptMatch(3);
    }

    function _mint() internal {
        MGD(mgdaddy).mint(deployer, 1_000_000e18);
    }

}