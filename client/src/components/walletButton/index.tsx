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
            className={`absolute top-5 right-5 bg-black/70 hover:bg-black/85 px-4 py-2 rounded-full text-white text-sm font-mono z-[1000] transition-colors duration-200 ${address ? 'cursor-default' : 'cursor-pointer'}`}
        >
            {isConnecting ? 'connecting...' : address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'connect'}
        </div>
    );
}
