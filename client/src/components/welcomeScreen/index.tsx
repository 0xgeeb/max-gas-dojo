"use client"

import { useEffect } from "react";
import { useConnection } from "wagmi"
import { useWallet } from '../../providers';

export const WelcomeScreen = ({ gameEngine }) => {
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

            {/* Decorative elements */}
            <div className="absolute top-20 right-20 w-32 h-32 border border-gray-200 rounded-full opacity-40"></div>
            <div className="absolute bottom-32 left-16 w-24 h-24 border border-gray-200 rounded-full opacity-30"></div>

            {/* Content */}
            <div className="relative z-10 text-center px-4">
                {/* Logo */}
                <div className="mb-10">
                    <img
                        src="/assets/wclogo.png"
                        alt="Warrior Coin"
                        className="w-48 h-48 mx-auto object-contain filter drop-shadow-sm"
                    />
                </div>

                {/* Title */}
                <h1 className="text-5xl font-semibold text-gray-900 mb-3 tracking-tight">
                    Martial Hero Fighter
                </h1>
                <p className="text-base text-gray-500 mb-12 max-w-sm mx-auto font-light">
                    Connect your wallet and challenge other players in epic 1v1 battles
                </p>

                {/* Wallet Connection */}
                <div className="space-y-4">
                    {!address ? (
                        <button
                            onClick={handleConnectWallet}
                            disabled={isConnecting}
                            className="px-10 py-3.5 bg-gray-900 text-white text-base font-medium rounded-md
                                     hover:bg-gray-800 transition-colors duration-150
                                     disabled:opacity-50 disabled:cursor-not-allowed
                                     shadow-sm hover:shadow-md"
                        >
                            {isConnecting ? 'Connecting...' : 'Connect Wallet'}
                        </button>
                    ) : (
                        <div className="space-y-4">
                            <div className="text-gray-600 text-sm font-mono bg-white border border-gray-200 rounded-md px-4 py-2 inline-block shadow-sm">
                                {`${address.slice(0, 6)}...${address.slice(-4)}`}
                            </div>
                            <button
                                onClick={handleEnterLobby}
                                className="block w-full max-w-xs mx-auto px-10 py-3.5 bg-gray-900
                                         text-white text-base font-medium rounded-md
                                         hover:bg-gray-800 transition-colors duration-150
                                         shadow-sm hover:shadow-md"
                            >
                                Enter Lobby
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer info */}
                <div className="mt-16 text-gray-400 text-sm font-light">
                    <p>Challenge other players • Stake tokens • Prove your skills</p>
                </div>
            </div>
        </div>
    );
}
