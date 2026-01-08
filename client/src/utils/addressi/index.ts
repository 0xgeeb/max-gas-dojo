import escrowABI from "../abi/WizardsCentralEscrow.json"
import wcABI from "../abi/WC.json"

export const contracts = {
    escrow: {
        address: "0xc6f4D3Ae8443f091A9c5015041093F3c0a41956f",
        abi: escrowABI.abi
    },
    wc: {
        address: "0x8016269e0c30d897f495470aC464c283bf51A77b",
        abi: wcABI.abi
    }
}