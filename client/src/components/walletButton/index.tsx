"use client"

import { useConnection } from "wagmi"
import { useWallet } from '../../providers';

export const WalletButton = ({ gameEngine }) => {
    const { connectWallet  } = useWallet()
    const { address, isConnecting } = useConnection()

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
            alert('Failed to connect wallet: ' + error.message);
        }
    };

    return (
        <div
            onClick={handleConnect}
            className={`absolute top-6 right-6 bg-white/95 backdrop-blur-sm hover:bg-white border border-gray-200 px-5 py-2.5 rounded-full text-gray-900 text-sm font-mono z-[1000] transition-all duration-200 shadow-sm hover:shadow-md ${address ? 'cursor-default' : 'cursor-pointer hover:border-gray-300'}`}
        >
            {isConnecting ? 'connecting...' : address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'connect wallet'}
        </div>
    );
}
