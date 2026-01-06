import { useEffect, useRef } from 'react';
import { GameEngine } from '../game/GameEngine.js';

export default function Game({
    onSceneChange,
    onLobbyStateChange,
    onWalletChange,
    onChallengeReceived,
    onToastMessage,
    setGameEngine
}) {
    const canvasRef = useRef(null);
    const gameEngineRef = useRef(null);

    useEffect(() => {
        // Initialize game engine ONCE
        const canvas = canvasRef.current;
        const engine = new GameEngine(canvas);

        // Set up callbacks
        engine.onSceneChange = onSceneChange;
        engine.onLobbyStateChange = onLobbyStateChange;
        engine.onWalletChange = onWalletChange;
        engine.onChallengeReceived = onChallengeReceived;
        engine.onToastMessage = onToastMessage;

        gameEngineRef.current = engine;

        // Pass engine to parent
        if (setGameEngine) {
            setGameEngine(engine);
        }

        // Start the game loop
        engine.start();

        // Cleanup on unmount
        return () => {
            engine.stop();
        };
    }, []); // Empty deps - only run once!

    return (
        <canvas
            ref={canvasRef}
            width={800}
            height={600}
            className="block w-full h-full"
        />
    );
}
