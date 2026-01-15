import { useState, useEffect } from 'react';

export const FightUI = ({ gameEngine }) => {
    const [gameState, setGameState] = useState(null);
    const [playerId, setPlayerId] = useState(null);

    useEffect(() => {
        if (!gameEngine) return;

        setPlayerId(gameEngine.getPlayerId());

        const originalGameState = gameEngine.onGameStateUpdate;
        gameEngine.onGameStateUpdate = (state) => {
            setGameState(state);
            if (originalGameState) originalGameState(state);
        };

        // Get initial state if available
        if (gameEngine.gameState) {
            setGameState(gameEngine.gameState);
        }

        return () => {
            gameEngine.onGameStateUpdate = originalGameState;
        };
    }, [gameEngine]);

    if (!gameState || !gameState.players || gameState.players.length < 2) {
        return null;
    }

    const myPlayer = gameState.players.find(p => p.id === playerId);
    const opponent = gameState.players.find(p => p.id !== playerId);

    if (!myPlayer || !opponent) return null;

    const formatAddress = (address) => {
        if (!address) return 'Player';
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    };

    return (
        <div className="absolute top-0 left-0 right-0 p-4 z-[100]">
            <div className="flex items-center justify-between gap-4 max-w-3xl mx-auto">
                {/* My Health Bar - Left Side */}
                <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-mono text-white drop-shadow-md">
                            {formatAddress(myPlayer.walletAddress)} (You)
                        </span>
                        <span className="text-xs font-bold text-white drop-shadow-md">
                            {Math.max(0, myPlayer.health)}%
                        </span>
                    </div>
                    <div className="h-6 bg-black/50 rounded-full overflow-hidden border-2 border-white/30 shadow-lg">
                        <div
                            className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-200 ease-out rounded-full"
                            style={{
                                width: `${Math.max(0, myPlayer.health)}%`,
                                background: myPlayer.health > 50
                                    ? 'linear-gradient(to right, #22c55e, #4ade80)'
                                    : myPlayer.health > 25
                                        ? 'linear-gradient(to right, #eab308, #facc15)'
                                        : 'linear-gradient(to right, #dc2626, #ef4444)'
                            }}
                        />
                    </div>
                </div>

                {/* VS Divider */}
                <div className="text-white font-bold text-lg drop-shadow-md px-2">
                    VS
                </div>

                {/* Opponent Health Bar - Right Side */}
                <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-white drop-shadow-md">
                            {Math.max(0, opponent.health)}%
                        </span>
                        <span className="text-xs font-mono text-white drop-shadow-md">
                            {formatAddress(opponent.walletAddress)}
                        </span>
                    </div>
                    <div className="h-6 bg-black/50 rounded-full overflow-hidden border-2 border-white/30 shadow-lg">
                        <div
                            className="h-full transition-all duration-200 ease-out rounded-full ml-auto"
                            style={{
                                width: `${Math.max(0, opponent.health)}%`,
                                background: opponent.health > 50
                                    ? 'linear-gradient(to left, #dc2626, #ef4444)'
                                    : opponent.health > 25
                                        ? 'linear-gradient(to left, #eab308, #facc15)'
                                        : 'linear-gradient(to left, #dc2626, #ef4444)'
                            }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
