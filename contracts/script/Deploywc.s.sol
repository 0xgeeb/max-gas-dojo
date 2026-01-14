// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { Script, console } from "../lib/forge-std/src/Script.sol";
import { WC } from "../src/WC.sol";
import { WizardsCentralEscrow } from "../src/WizardsCentralEscrow.sol";

contract DeployScript is Script {

    WC wc;
    WizardsCentralEscrow escrow;

    address deployer = 0x895614c89beC7D11454312f740854d08CbF57A78;
    address resolver = 0x895614c89beC7D11454312f740854d08CbF57A78;
    address feeCollector = 0x895614c89beC7D11454312f740854d08CbF57A78;

    address oldwcaddy = 0x8016269e0c30d897f495470aC464c283bf51A77b;
    address oldescrowaddy = 0xc6f4D3Ae8443f091A9c5015041093F3c0a41956f;

    address wcaddy = 0x1FD5270705F2F6b69a57b1eb72901031b1c46752;
    address escrowaddy = 0x186C96B9c362DBBf4D33C6dAd04127F0238F5499;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PK");
        vm.startBroadcast(deployerPrivateKey);

        // _deployWC();
        _cancel();
        // _accept();

        vm.stopBroadcast();
    }

    function _deployWC() internal {
        wc = new WC();
        escrow = new WizardsCentralEscrow(address(wc), resolver, feeCollector);
        wc.mint(deployer, 100e18);
    }

    function _cancel() internal {
        WizardsCentralEscrow(escrowaddy).cancelMatch(3);
    }

    function _accept() internal {
        WizardsCentralEscrow(escrowaddy).acceptMatch(3);
    }

}