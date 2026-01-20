// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { Script, console } from "../lib/forge-std/src/Script.sol";
import { MGD } from "../src/MGD.sol";
import { MaxGasDojoEscrow } from "../src/MaxGasDojoEscrow.sol";

contract DeployScript is Script {

    MGD mgd;
    MaxGasDojoEscrow escrow;

    address server = 0x895614c89beC7D11454312f740854d08CbF57A78;
    address dev = 0x05067835561cDaea1578Fe77dAA20d2890505534;
    address ape = 0x682F8b083762F9Ac760D9717aEc6321d1F4a585d;
    address oldgeeb = 0x7A1aCe83A33D111c373871D5964857875aB39Add;

    address oldoldmgdaddy = 0x8016269e0c30d897f495470aC464c283bf51A77b;
    address oldoldescrowaddy = 0xc6f4D3Ae8443f091A9c5015041093F3c0a41956f;
    address oldmgdaddy = 0x1FD5270705F2F6b69a57b1eb72901031b1c46752;
    address oldescrowaddy = 0x186C96B9c362DBBf4D33C6dAd04127F0238F5499;

    address mgdaddy = 0x35E4FA6F650613d8f692C0ab4f12eb09AD26208c;
    address escrowaddy = 0xC786901b38d0148C791dc7e4e50AEF462Ce2d042;

    function run() external {
        uint256 devPrivateKey = vm.envUint("PK");
        vm.startBroadcast(devPrivateKey);

        // _deployMGD();
        // _cancel();
        // _accept();
        _mint();

        vm.stopBroadcast();
    }

    function _deployMGD() internal {
        mgd = new MGD();
        escrow = new MaxGasDojoEscrow(address(mgd), server, ape);
        mgd.mint(dev, 1_000_000e18);
    }

    function _cancel() internal {
        MaxGasDojoEscrow(escrowaddy).cancelMatch(3);
    }

    function _accept() internal {
        MaxGasDojoEscrow(escrowaddy).acceptMatch(3);
    }

    function _mint() internal {
        MGD(mgdaddy).mint(oldgeeb, 69_000_000e18);
    }

}