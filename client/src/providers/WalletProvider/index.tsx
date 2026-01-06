"use client"

import {
    useContext,
    createContext,
    PropsWithChildren,
    useCallback
} from "react"
import { useConnection, useConnect, useConnectors } from "wagmi"

const WALLET_PROVIDER_INITIAL_STATE = {
    connectWallet: async () => undefined
}

const WalletContext = createContext(WALLET_PROVIDER_INITIAL_STATE)

export const WalletProvider = (props: PropsWithChildren<{}>) => {
    const { children } = props
    const { address } = useConnection()
    const connect = useConnect()
    const connectors = useConnectors()
    
    const connectWallet = useCallback(async (): Promise<string | undefined> => {
        const injectedConnector = connectors.find(c => c.id === 'injected')
        connect.mutate({ connector: injectedConnector })
        return address

    }, [connect, connectors, address])

    return (
        <WalletContext.Provider value={{connectWallet}}>
            {children}
        </WalletContext.Provider>
    )
}

export const useWallet = () => useContext(WalletContext)