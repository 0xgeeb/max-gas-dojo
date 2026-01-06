import { useState, useEffect } from 'react';

export const LobbyUI = ({ gameEngine, lobbyState, playerId }) => {
    const [incomingChallenges, setIncomingChallenges] = useState([]);

    useEffect(() => {
        if (!gameEngine) return;

        // Listen for incoming challenges
        const originalCallback = gameEngine.onChallengeReceived;
        gameEngine.onChallengeReceived = (challenge) => {
            setIncomingChallenges(prev => [...prev, challenge]);
            if (originalCallback) originalCallback(challenge);
        };

        return () => {
            gameEngine.onChallengeReceived = originalCallback;
        };
    }, [gameEngine]);

    const handleChallenge = (targetPlayerId) => {
        const wager = prompt('Enter wager amount (tokens):', '1');
        if (wager !== null && wager !== '') {
            const amount = parseFloat(wager);
            if (isNaN(amount) || amount < 0) {
                alert('Please enter a valid wager amount');
                return;
            }
            gameEngine.sendChallenge(targetPlayerId, amount);
        }
    };

    const handleAcceptChallenge = (challengeId) => {
        gameEngine.acceptChallenge(challengeId);
        setIncomingChallenges(prev => prev.filter(c => c.challengeId !== challengeId));
    };

    const handleDeclineChallenge = (challengeId) => {
        gameEngine.declineChallenge(challengeId);
        setIncomingChallenges(prev => prev.filter(c => c.challengeId !== challengeId));
    };

    const formatAddress = (address) => {
        if (!address) return '';
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    };

    return (
        <>
            {/* Player List Sidebar */}
            <div className="absolute top-0 left-0 w-[250px] h-screen bg-transparent text-white overflow-y-auto p-5 z-[100]">
                <div className="flex justify-between mb-5 pb-2.5 border-b-2 border-white">
                    <h3 className="m-0 text-lg">Players in Lobby</h3>
                    <span className="text-white font-bold">
                        {lobbyState?.players?.length || 0}/10
                    </span>
                </div>
                <div>
                    {lobbyState?.players?.map(player => (
                        <div
                            key={player.id}
                            className={`
                                bg-white/10 p-2.5 mb-2.5 rounded-md flex justify-between items-center
                                ${player.id === playerId ? 'bg-blue-500/30 border border-blue-500' : ''}
                            `}
                        >
                            <span
                                className="text-xs overflow-hidden text-ellipsis whitespace-nowrap max-w-[120px]"
                                title={player.walletAddress || player.id}
                            >
                                {player.walletAddress
                                    ? formatAddress(player.walletAddress)
                                    : `Player ${player.id.slice(0, 6)}`}
                            </span>
                            {player.id !== playerId ? (
                                <button
                                    className="bg-blue-500 hover:bg-blue-600 text-white border-none px-4 py-1 rounded cursor-pointer text-xs transition-colors"
                                    onClick={() => handleChallenge(player.id)}
                                >
                                    Challenge
                                </button>
                            ) : (
                                <span className="text-[10px] text-blue-500">(You)</span>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Challenge Modal */}
            {incomingChallenges.length > 0 && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/95 p-8 rounded-lg z-[1000] min-w-[400px] border-2 border-blue-500 text-white">
                    <h2 className="mt-0 text-blue-500">Incoming Challenges</h2>
                    {incomingChallenges.map(challenge => (
                        <div key={challenge.challengeId} className="bg-white/10 p-4 mb-4 rounded-md">
                            <p className="my-1">
                                <strong>
                                    Challenge from{' '}
                                    {challenge.challengerWallet
                                        ? formatAddress(challenge.challengerWallet)
                                        : `Player ${challenge.challenger.slice(0, 6)}`}
                                </strong>
                            </p>
                            <p className="my-1">Wager: {challenge.wagerAmount} tokens</p>
                            <div className="flex gap-2.5 mt-2.5">
                                <button
                                    className="bg-green-600 hover:bg-green-700 text-white border-none px-5 py-2 rounded cursor-pointer flex-1 transition-colors"
                                    onClick={() => handleAcceptChallenge(challenge.challengeId)}
                                >
                                    Accept
                                </button>
                                <button
                                    className="bg-red-600 hover:bg-red-700 text-white border-none px-5 py-2 rounded cursor-pointer flex-1 transition-colors"
                                    onClick={() => handleDeclineChallenge(challenge.challengeId)}
                                >
                                    Decline
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}
