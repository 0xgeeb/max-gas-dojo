import { useEffect, useRef } from 'react';
import { GameEngine } from '../../game/GameEngine.js';

export const Game = ({
    onSceneChange,
    onLobbyStateChange,
    onToastMessage,
    onLobbyFull,
    setGameEngine
}) => {
    const canvasRef = useRef(null);
    const gameEngineRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const engine = new GameEngine(canvas);

        engine.onSceneChange = onSceneChange;
        engine.onLobbyStateChange = onLobbyStateChange;
        engine.onToastMessage = onToastMessage;
        engine.onLobbyFull = onLobbyFull;

        gameEngineRef.current = engine;

        if (setGameEngine) {
            setGameEngine(engine);
        }

        engine.start();

        return () => {
            engine.stop();
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            width={800}
            height={600}
            className="block w-full h-full"
        />
    );
}