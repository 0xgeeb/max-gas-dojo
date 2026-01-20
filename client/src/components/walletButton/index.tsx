"use client"

import { useState } from "react"
import { useConnection } from "wagmi"
import { base } from "wagmi/chains"
import { useWallet } from '../../providers';

export const WalletButton = ({ gameEngine }) => {
    const { connectWallet, wcBalance, sendMintTx } = useWallet()
    const { address, isConnecting } = useConnection()
    const connection = useConnection()
    const isWrongChain = connection.chainId !== base.id
    const [showHowItWorks, setShowHowItWorks] = useState(false)
    const [isMinting, setIsMinting] = useState(false)

    const handleConnect = async () => {
        if (address || !gameEngine) return;

        try {
            await connectWallet();

            // Wait for wallet connection to complete, then join lobby
            if (address) {
                gameEngine.joinLobby(address);
            }
        } catch (error) {
            console.error('Error connecting wallet:', error);
        }
    };

    const handleMint = async () => {
        setIsMinting(true);
        try {
            await sendMintTx();
        } catch (error) {
            console.error('Error minting:', error);
        } finally {
            setIsMinting(false);
        }
    };

    return (
        <>
            <div className="absolute top-6 right-6 z-[1000] flex items-center gap-3">
                {/* How It Works Button */}
                <button
                    onClick={() => setShowHowItWorks(true)}
                    className="w-10 h-10 bg-white/95 backdrop-blur-sm
                             hover:bg-white border border-gray-200 rounded-full
                             text-gray-900 text-lg font-semibold
                             transition-all duration-200 shadow-sm hover:shadow-md
                             flex items-center justify-center"
                    aria-label="How it works"
                >
                    ?
                </button>

                {/* Wallet Info */}
                <div
                    onClick={handleConnect}
                    className={`bg-white/95 backdrop-blur-sm hover:bg-white border border-gray-200 px-5 py-2.5 rounded-full text-gray-900 text-sm font-mono transition-all duration-200 shadow-sm hover:shadow-md flex items-center gap-3 ${address ? 'cursor-default' : 'cursor-pointer hover:border-gray-300'}`}
                >
                    {isConnecting ? 'connecting...' : address ? (
                        <>
                            <span>{wcBalance?.toFixed(2) || '0.00'} $MGD</span>
                            <span className="text-gray-400">|</span>
                            <span>{address.slice(0, 6)}...{address.slice(-4)}</span>
                        </>
                    ) : 'connect wallet'}
                </div>
            </div>

            {/* How It Works Modal */}
            {showHowItWorks && (
                <div
                    className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[1001] flex items-center justify-center cursor-pointer"
                    onClick={() => setShowHowItWorks(false)}
                >
                    <div
                        className="bg-white rounded-xl shadow-xl border border-gray-200 p-8 max-w-md mx-4 cursor-default"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 className="text-2xl font-semibold text-gray-900 mb-4">How It Works</h2>
                        <p className="text-gray-600 leading-relaxed">
                            Welcome to the Max Gas Dojo. Here players can fight against others and wager $MGD tokens on the outcome of the match. Players can cancel a match if their opponent does not respond and receive their wager back.
                        </p>
                        <p className="text-gray-600 leading-relaxed mt-4">
                            There is a 5% fee on wagers. Mint $MGD tokens below to play!
                        </p>
                        <button
                            onClick={handleMint}
                            disabled={isMinting || isWrongChain}
                            className="mt-6 w-full px-6 py-3 bg-gray-900 text-white text-sm font-medium rounded-lg
                                     hover:bg-gray-800 transition-all duration-200
                                     disabled:opacity-50 disabled:cursor-not-allowed
                                     shadow-md hover:shadow-lg"
                        >
                            {isMinting ? 'Minting...' : 'Mint 1M $MGD'}
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
