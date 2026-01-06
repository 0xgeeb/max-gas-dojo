import { useState } from 'react';

export default function WalletButton({ gameEngine }) {
    const [walletAddress, setWalletAddress] = useState(null);
    const [isConnecting, setIsConnecting] = useState(false);

    const handleConnect = async () => {
        if (walletAddress || !gameEngine) return;

        try {
            setIsConnecting(true);
            const address = await gameEngine.connectWallet();
            setWalletAddress(address);

            // Automatically join lobby after connecting
            gameEngine.joinLobby();
        } catch (error) {
            console.error('Error connecting wallet:', error);
            alert('Failed to connect wallet: ' + error.message);
        } finally {
            setIsConnecting(false);
        }
    };

    const formatAddress = (address) => {
        if (!address) return '';
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    };

    return (
        <div
            onClick={handleConnect}
            className={`absolute top-5 right-5 bg-black/70 hover:bg-black/85 px-4 py-2 rounded-full text-white text-sm font-mono z-[1000] transition-colors duration-200 ${walletAddress ? 'cursor-default' : 'cursor-pointer'}`}
        >
            {isConnecting ? 'connecting...' : walletAddress ? formatAddress(walletAddress) : 'connect'}
        </div>
    );
}
