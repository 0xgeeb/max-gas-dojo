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
    const [isLobbyFull, setIsLobbyFull] = useState(false);

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

    const handleLobbyFull = () => {
        setIsLobbyFull(true);
    };

    return (
        <WagmiProvider>
            <WalletProvider>
                <div className="relative w-screen h-screen overflow-hidden bg-[#faf9f7]">
                    {currentScene === 'welcome' && (
                        <WelcomeScreen gameEngine={gameEngine} isLobbyFull={isLobbyFull} />
                    )}

                    <div className={currentScene === 'welcome' ? 'hidden' : ''}>
                        <Game
                            onSceneChange={handleSceneChange}
                            onLobbyStateChange={handleLobbyStateChange}
                            onToastMessage={handleToastMessage}
                            onLobbyFull={handleLobbyFull}
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
