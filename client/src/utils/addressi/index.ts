import escrowABI from "../abi/WizardsCentralEscrow.json"
import mgdABI from "../abi/MGD.json"

export const contracts = {
    escrow: {
        address: "0x186C96B9c362DBBf4D33C6dAd04127F0238F5499",
        abi: escrowABI.abi
    },
    mgd: {
        address: "0x1FD5270705F2F6b69a57b1eb72901031b1c46752",
        abi: mgdABI.abi
    }
}