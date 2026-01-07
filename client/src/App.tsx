import { useState, useEffect } from 'react';
import {
    Game,
    WalletButton,
    LobbyUI,
    Toast,
    WelcomeScreen
} from "./components"
import {
    WagmiProvider,
    WalletProvider
} from "./providers"

function App() {
    const [gameEngine, setGameEngine] = useState(null);
    const [currentScene, setCurrentScene] = useState('welcome');
    const [lobbyState, setLobbyState] = useState(null);
    const [toastMessage, setToastMessage] = useState('');

    const handleSceneChange = (scene) => {
        setCurrentScene(scene);
    };

    const handleLobbyStateChange = (state) => {
        setLobbyState(state);
    };

    const handleToastMessage = (message) => {
        setToastMessage(message);
    };

    const handleToastClose = () => {
        setToastMessage('');
    };

    return (
        <WagmiProvider>
            <WalletProvider>
                <div className="relative w-screen h-screen overflow-hidden bg-sky-400">
                    {currentScene === 'welcome' && (
                        <WelcomeScreen gameEngine={gameEngine} />
                    )}

                    <div className={currentScene === 'welcome' ? 'hidden' : ''}>
                        <Game
                            onSceneChange={handleSceneChange}
                            onLobbyStateChange={handleLobbyStateChange}
                            onToastMessage={handleToastMessage}
                            setGameEngine={setGameEngine}
                        />
                    </div>

                    {currentScene === 'lobby' && (
                        <WalletButton gameEngine={gameEngine} />
                    )}

                    {currentScene === 'lobby' && lobbyState && (
                        <LobbyUI
                            gameEngine={gameEngine}
                            lobbyState={lobbyState}
                        />
                    )}
                    
                    {/* todo: change to better looking messages */}
                    {toastMessage && (
                        <Toast
                            message={toastMessage}
                            duration={3000}
                            onClose={handleToastClose}
                        />
                    )}
                </div>
            </WalletProvider>
        </WagmiProvider>
    );
}

export default App;
