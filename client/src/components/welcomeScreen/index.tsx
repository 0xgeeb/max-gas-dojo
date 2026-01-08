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
        <div className="relative w-screen h-screen overflow-hidden bg-gradient-to-b from-gray-900 via-purple-900 to-violet-900 flex items-center justify-center">
            {/* Background pattern */}
            <div className="absolute inset-0 opacity-10">
                <div className="absolute inset-0" style={{
                    backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
                    backgroundSize: '40px 40px'
                }}></div>
            </div>

            {/* Content */}
            <div className="relative z-10 text-center px-4">
                {/* Logo */}
                <div className="mb-8">
                    <img
                        src="/assets/wclogo.png"
                        alt="Warrior Coin"
                        className="w-64 h-64 mx-auto object-contain drop-shadow-2xl"
                    />
                </div>

                {/* Title */}
                <h1 className="text-6xl font-bold text-white mb-4 drop-shadow-lg">
                    Martial Hero Fighter
                </h1>
                <p className="text-xl text-gray-300 mb-12 max-w-md mx-auto">
                    Connect your wallet and challenge other players in epic 1v1 battles
                </p>

                {/* Wallet Connection */}
                <div className="space-y-4">
                    {!address ? (
                        <button
                            onClick={handleConnectWallet}
                            disabled={isConnecting}
                            className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-lg font-bold rounded-lg
                                     hover:from-purple-700 hover:to-pink-700 transition-all duration-200
                                     disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl
                                     transform hover:scale-105"
                        >
                            {isConnecting ? 'Connecting...' : 'Connect Wallet'}
                        </button>
                    ) : (
                        <div className="space-y-4">
                            <div className="text-green-400 text-sm font-mono bg-black/30 rounded-lg px-4 py-2 inline-block">
                                {`${address.slice(0, 6)}...${address.slice(-4)}`}
                            </div>
                            <button
                                onClick={handleEnterLobby}
                                className="block w-full max-w-xs mx-auto px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600
                                         text-white text-lg font-bold rounded-lg
                                         hover:from-green-700 hover:to-emerald-700 transition-all duration-200
                                         shadow-lg hover:shadow-xl transform hover:scale-105"
                            >
                                Enter Lobby
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer info */}
                <div className="mt-16 text-gray-400 text-sm">
                    <p>Challenge other players • Stake tokens • Prove your skills</p>
                </div>
            </div>
        </div>
    );
}
