"use client"

import { useEffect } from "react";
import { useConnection } from "wagmi"
import { useWallet } from '../../providers';

export const WelcomeScreen = ({ gameEngine, isLobbyFull }) => {
    const { refreshWc, connectWallet } = useWallet();
    const { address, isConnecting } = useConnection()

    useEffect(() => {
        if (address) {
            refreshWc()
        }
    }, [address])

    const handleConnectWallet = async () => {
        try {
            await connectWallet();
        } catch (error) {
            console.error('Failed to connect wallet:', error);
        }
    };

    const handleEnterLobby = () => {
        if (!gameEngine || !address) return;

        gameEngine.joinLobby(address);
    };

    return (
        <div className="relative w-screen h-screen overflow-hidden bg-[#faf9f7] flex items-center justify-center">
            {/* Subtle grid pattern */}
            <div className="absolute inset-0 opacity-[0.03]" style={{
                backgroundImage: `
                    linear-gradient(to right, #000 1px, transparent 1px),
                    linear-gradient(to bottom, #000 1px, transparent 1px)
                `,
                backgroundSize: '60px 60px'
            }}></div>

            {/* Content */}
            <div className="relative z-10 text-center px-4">
                {/* Logo */}
                <div className="mb-8">
                    <img
                        src="/assets/mgdlogo.png"
                        alt="Max Gas Dojo"
                        className="w-52 h-52 mx-auto object-contain hover:scale-[1.02] transition-transform duration-300"
                    />
                </div>

                {/* Title */}
                <h1 className="text-5xl md:text-6xl font-semibold text-gray-900 mb-2 tracking-tight">
                    Max Gas Dojo
                </h1>
                <p className="text-base text-gray-400 mb-12 max-w-sm mx-auto tracking-wide">
                    2D PVP fights with token wagers
                </p>

                {/* Lobby Full Message */}
                {isLobbyFull && (
                    <div className="mb-8 bg-white border border-red-200 rounded-lg px-6 py-4 max-w-sm mx-auto shadow-sm">
                        <p className="text-red-700 text-sm font-medium mb-1">Sorry the lobby is full :( please try again later</p>
                        <p className="text-red-500 text-sm">
                            Tell me on twitter its full{' '}
                            <a
                                href="https://x.com/0xgeeb"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-semibold underline hover:text-red-700 transition-colors"
                            >
                                @0xgeeb
                            </a>
                        </p>
                    </div>
                )}

                {/* Wallet Connection */}
                <div className="space-y-4">
                    {!address ? (
                        <button
                            onClick={handleConnectWallet}
                            disabled={isConnecting}
                            className="px-12 py-4 bg-gray-900 text-white text-base font-medium rounded-lg
                                     hover:bg-gray-800 transition-all duration-200
                                     disabled:opacity-50 disabled:cursor-not-allowed
                                     shadow-md hover:shadow-lg hover:scale-[1.01] active:scale-[0.99]"
                        >
                            {isConnecting ? 'Connecting...' : 'Connect Wallet'}
                        </button>
                    ) : (
                        <div className="space-y-5">
                            <div className="inline-flex items-center gap-2.5 text-gray-600 text-sm font-mono
                                          bg-white border border-gray-200 rounded-lg px-5 py-2.5 shadow-sm">
                                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                                {`${address.slice(0, 6)}...${address.slice(-4)}`}
                            </div>
                            <button
                                onClick={handleEnterLobby}
                                disabled={isLobbyFull}
                                className="block w-full max-w-xs mx-auto px-12 py-4 bg-gray-900
                                         text-white text-base font-medium rounded-lg
                                         hover:bg-gray-800 transition-all duration-200
                                         shadow-md hover:shadow-lg hover:scale-[1.01] active:scale-[0.99]
                                         disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                            >
                                Enter Lobby
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
