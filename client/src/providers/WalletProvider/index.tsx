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
import { base } from "wagmi/chains"
import { config } from "../../providers/WagmiProvider"
import { contracts } from "../../utils/addressi"

const INITIAL_STATE = {
    wcAllowance: 0,
    wcBalance: 0,
    connectWallet: async () => undefined,
    refreshWc: async () => {},
    sendWcApproveTx: async (_wager: number) => undefined as string | undefined,
    sendCreateMatchTx: async (_opponent: string, _wager: number) => undefined as { txHash: string, matchId: number } | undefined,
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
        console.log('refreshing balances')
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

    const sendWcApproveTx = async (wager: number): Promise<string> => {
        try {
            const hash = await writeContract(config, {
                address: contracts.wc.address as `0x${string}`,
                abi: contracts.wc.abi,
                functionName: 'approve',
                args: [contracts.escrow.address, parseEther(`${wager}`)],
                chain: base,
                account: address
            })
            const data = await waitForTransactionReceipt(config, { hash })
            await refreshWc()
            return data.transactionHash
        }
        catch (e) {
            console.log("user denied tx");
            console.log("or: ", e);
            throw e;
        }
    }

    const sendCreateMatchTx = async (opponent: string, wager: number): Promise<{ txHash: string, matchId: number }> => {
        try {
            const hash = await writeContract(config, {
                address: contracts.escrow.address as `0x${string}`,
                abi: contracts.escrow.abi,
                functionName: 'createMatch',
                args: [opponent, parseEther(`${wager}`)],
                chain: base,
                account: address
            })
            const receipt = await waitForTransactionReceipt(config, { hash })

            // Parse the MatchCreated event to get the match ID
            const matchCreatedEvent = receipt.logs.find(log =>
                log.topics[0] === '0x2c9089bdab8aeea6a8c5e41b785290b63781dd5c648c9c824bcc0883237cff32' // MatchCreated event signature
            );

            let matchId = 0;
            if (matchCreatedEvent && matchCreatedEvent.data) {
                // Decode the matchID from the event data (first 32 bytes)
                matchId = parseInt(matchCreatedEvent.data.slice(0, 66), 16);
            }

            return { txHash: receipt.transactionHash, matchId };
        }
        catch (e) {
            console.log("user denied tx");
            console.log("or: ", e);
            throw e;
        }
    }

    const sendAcceptMatchTx = async (id: number): Promise<string> => {
        try {
            const hash = await writeContract(config, {
                address: contracts.escrow.address as `0x${string}`,
                abi: contracts.escrow.abi,
                functionName: 'acceptMatch',
                args: [id],
                chain: base,
                account: address
            })
            const data = await waitForTransactionReceipt(config, { hash })
            return data.transactionHash
        }
        catch (e) {
            console.log("user denied tx");
            console.log("or: ", e);
            throw e;
        }
    }

    const sendCancelMatchTx = async (id: number): Promise<string> => {
        try {
            const hash = await writeContract(config, {
                address: contracts.escrow.address as `0x${string}`,
                abi: contracts.escrow.abi,
                functionName: 'cancelMatch',
                args: [id],
                chain: base,
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