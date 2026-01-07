import escrowABI from "../abi/WizardsCentralEscrow.json"
import wcABI from "../abi/WC.json"

export const contracts = {
    escrow: {
        address: "0xb7E448E5677D212B8C8Da7D6312E8Afc49800466",
        abi: escrowABI.abi
    },
    wc: {
        address: "0x98C23E9d8f34FEFb1B7BD6a91B7FF122F4e16F5c",
        abi: wcABI.abi
    }
}