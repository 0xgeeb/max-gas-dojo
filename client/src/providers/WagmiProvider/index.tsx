"use client"

import { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider as WagmiClientProvider, http, createConfig } from "wagmi";
import { base } from "wagmi/chains"
import { injected } from "wagmi/connectors"

export const config = createConfig({
    chains: [base],
    connectors: [injected()],
    transports: {
        [base.id]: http()
    }
})

const queryClient = new QueryClient()

export const WagmiProvider = (props: PropsWithChildren<{}>) => {

    const { children } = props;

    return (
        <WagmiClientProvider config={config}>
            <QueryClientProvider client={queryClient}>
                { children }
            </QueryClientProvider>
        </WagmiClientProvider>
    )
}