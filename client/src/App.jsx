import { useState } from 'react';
import Game from './components/Game.jsx';
import WalletButton from './components/WalletButton.jsx';
import LobbyUI from './components/LobbyUI.jsx';
import Toast from './components/Toast.jsx';

function App() {
    const [gameEngine, setGameEngine] = useState(null);
    const [currentScene, setCurrentScene] = useState('waiting');
    const [lobbyState, setLobbyState] = useState(null);
    const [playerId, setPlayerId] = useState(null);
    const [toastMessage, setToastMessage] = useState('');

    const handleSceneChange = (scene) => {
        setCurrentScene(scene);
    };

    const handleLobbyStateChange = (state) => {
        setLobbyState(state);
        if (gameEngine && !playerId) {
            setPlayerId(gameEngine.getPlayerId());
        }
    };

    const handleToastMessage = (message) => {
        setToastMessage(message);
    };

    const handleToastClose = () => {
        setToastMessage('');
    };

    return (
        <div className="relative w-screen h-screen overflow-hidden bg-sky-400">
            <Game
                onSceneChange={handleSceneChange}
                onLobbyStateChange={handleLobbyStateChange}
                onToastMessage={handleToastMessage}
                setGameEngine={setGameEngine}
            />

            <WalletButton gameEngine={gameEngine} />

            {currentScene === 'lobby' && lobbyState && (
                <LobbyUI
                    gameEngine={gameEngine}
                    lobbyState={lobbyState}
                    playerId={playerId}
                />
            )}

            {toastMessage && (
                <Toast
                    message={toastMessage}
                    duration={3000}
                    onClose={handleToastClose}
                />
            )}
        </div>
    );
}

export default App;
