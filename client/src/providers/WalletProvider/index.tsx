"use client"

import {
    useContext,
    createContext,
    PropsWithChildren,
    useCallback,
    useState
} from "react"
import { useConnection, useConnect, useConnectors } from "wagmi"
import { formatEther, parseEther } from "viem"
import { writeContract, readContract, waitForTransactionReceipt } from "@wagmi/core"
import { mainnet } from "wagmi/chains"
import { config } from "../../providers/WagmiProvider"
import { contracts } from "../../utils/addressi"

const INITIAL_STATE = {
    wcAllowance: 0,
    wcBalance: 0,
    connectWallet: async () => undefined,
    refreshWc: async () => {},
    sendWcApproveTx: async () => undefined as string | undefined,
    sendCreateMatchTx: async (_opponent: string, _wager: number) => undefined as string | undefined,
    sendAcceptMatchTx: async (_id: number) => undefined as string | undefined,
    sendCancelMatchTx: async (_id: number) => undefined as string | undefined
}

const WalletContext = createContext(INITIAL_STATE)

export const WalletProvider = (props: PropsWithChildren<{}>) => {
    const { children } = props
    const { address } = useConnection()
    const connect = useConnect()
    const connectors = useConnectors()

    const [wcBalanceState, setWcBalanceState] = useState<number>(INITIAL_STATE.wcBalance)
    const [wcAllowanceState, setWcAllowanceState] = useState<number>(INITIAL_STATE.wcAllowance)
    
    const connectWallet = useCallback(async (): Promise<string | undefined> => {
        const injectedConnector = connectors.find(c => c.id === 'injected')
        connect.mutate({ connector: injectedConnector })
        return address

    }, [connect, connectors, address])

    const refreshWc = async () => {
        const wcAllowanceResult = await readContract(config, {
            address: contracts.wc.address as `0x${string}`,
            abi: contracts.wc.abi,
            functionName: 'allowance',
            args: [address, contracts.escrow.address],
            authorizationList: undefined
        })
        const wcBalanceResult = await readContract(config, {
            address: contracts.wc.address as `0x${string}`,
            abi: contracts.wc.abi,
            functionName: 'balanceOf',
            args: [address],
            authorizationList: undefined
        })

        setWcAllowanceState(parseFloat(formatEther(wcAllowanceResult as unknown as bigint)))
        setWcBalanceState(parseFloat(formatEther(wcBalanceResult as unknown as bigint)))
    }

    const sendWcApproveTx = async (): Promise<string> => {
        try {
            const hash = await writeContract(config, {
                address: contracts.wc.address as `0x${string}`,
                abi: contracts.wc.abi,
                functionName: 'approve',
                args: [contracts.escrow.address, address],
                chain: mainnet,
                account: address
            })
            const data = await waitForTransactionReceipt(config, { hash })
            return data.transactionHash
        }
        catch (e) {
            console.log("user denied tx");
            console.log("or: ", e);
        }
    }

    const sendCreateMatchTx = async (opponent: string, wager: number): Promise<string> => {
        try {
            const hash = await writeContract(config, {
                address: contracts.escrow.address as `0x${string}`,
                abi: contracts.escrow.abi,
                functionName: 'createMatch',
                args: [opponent, parseEther(`${wager}`)],
                chain: mainnet,
                account: address
            })
            const data = await waitForTransactionReceipt(config, { hash })
            return data.transactionHash
        }
        catch (e) {
            console.log("user denied tx");
            console.log("or: ", e);
        }
    }

    const sendAcceptMatchTx = async (id: number): Promise<string> => {
        try {
            const hash = await writeContract(config, {
                address: contracts.escrow.address as `0x${string}`,
                abi: contracts.escrow.abi,
                functionName: 'acceptMatch',
                args: [id],
                chain: mainnet,
                account: address
            })
            const data = await waitForTransactionReceipt(config, { hash })
            return data.transactionHash
        }
        catch (e) {
            console.log("user denied tx");
            console.log("or: ", e);
        }
    }

    const sendCancelMatchTx = async (id: number): Promise<string> => {
        try {
            const hash = await writeContract(config, {
                address: contracts.escrow.address as `0x${string}`,
                abi: contracts.escrow.abi,
                functionName: 'cancelMatch',
                args: [id],
                chain: mainnet,
                account: address
            })
            const data = await waitForTransactionReceipt(config, { hash })
            return data.transactionHash
        }
        catch (e) {
            console.log("user denied tx");
            console.log("or: ", e);
        }
    }

    return (
        <WalletContext.Provider value={{
            wcBalance: wcBalanceState,
            wcAllowance: wcAllowanceState,
            connectWallet,
            refreshWc,
            sendWcApproveTx,
            sendCreateMatchTx,
            sendAcceptMatchTx,
            sendCancelMatchTx
        }}>
            {children}
        </WalletContext.Provider>
    )
}

export const useWallet = () => useContext(WalletContext)