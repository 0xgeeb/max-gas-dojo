import escrowABI from "../abi/MaxGasDojoEscrow.json"
import mgdABI from "../abi/MGD.json"

export const contracts = {
    escrow: {
        address: "0xC786901b38d0148C791dc7e4e50AEF462Ce2d042",
        abi: escrowABI.abi
    },
    mgd: {
        address: "0x35E4FA6F650613d8f692C0ab4f12eb09AD26208c",
        abi: mgdABI.abi
    }
}