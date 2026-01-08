import { useState, useEffect } from 'react';
import { useWallet } from '../../providers/WalletProvider';
import { useConnection } from 'wagmi';
import { base } from 'wagmi/chains';

export const LobbyUI = ({ gameEngine, lobbyState }) => {
    const [incomingChallenges, setIncomingChallenges] = useState([]);
    const [playerId, setPlayerId] = useState(null);
    const [createWagerModal, setCreateWagerModal] = useState<boolean>(false)
    const [wager, setWager] = useState<number>(null)
    const [targetPlayerId, setTargetPlayerId] = useState<string>(null)
    const [isApproving, setIsApproving] = useState<boolean>(false)
    const [isCreatingMatch, setIsCreatingMatch] = useState<boolean>(false)

    const {
        wcBalance,
        wcAllowance,
        sendWcApproveTx,
        sendCreateMatchTx,
        sendAcceptMatchTx
    } = useWallet();

    const connection = useConnection();
    const isWrongChain = connection.chainId !== base.id;

    useEffect(() => {
        if (!gameEngine) return;

        const originalCallback = gameEngine.onChallengeReceived;
        gameEngine.onChallengeReceived = (challenge) => {
            setIncomingChallenges(prev => [...prev, challenge]);
            if (originalCallback) originalCallback(challenge);
        };
        setPlayerId(gameEngine.getPlayerId())

        return () => {
            gameEngine.onChallengeReceived = originalCallback;
        };
    }, [gameEngine]);

    const sendWager = async () => {
        if (!wager || isNaN(wager) || wager <= 0) return;
        const targetPlayer = lobbyState?.players?.find(p => p.id === targetPlayerId);

        try {
            if (wcAllowance < wager) {
                setIsApproving(true);
                await sendWcApproveTx(wager);
                setIsApproving(false);
            }

            setIsCreatingMatch(true);
            const result = await sendCreateMatchTx(targetPlayer.walletAddress, wager);

            if (result && result.txHash) {
                gameEngine.sendChallenge(targetPlayerId, wager, result.matchId);
                setCreateWagerModal(false);
                setWager(null);
                setTargetPlayerId(null);
            }
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setIsApproving(false);
            setIsCreatingMatch(false);
        }
    };

    const cancelWager = () => {
        setCreateWagerModal(false);
        setWager(null);
        setTargetPlayerId(null);
    };

    const handleAcceptChallenge = async (challengeId) => {
        const challenge = incomingChallenges.find(c => c.challengeId === challengeId);
        if (!challenge) return;

        try {
            // Check if approval is needed for the wager amount
            if (wcAllowance < challenge.wagerAmount) {
                await sendWcApproveTx(challenge.wagerAmount);
            }

            // Accept the match on the blockchain
            if (challenge.matchId !== undefined) {
                const txHash = await sendAcceptMatchTx(challenge.matchId);
                if (!txHash) {
                    // User rejected or transaction failed
                    return;
                }
            }

            // Then notify the game engine
            gameEngine.acceptChallenge(challengeId);
            setIncomingChallenges(prev => prev.filter(c => c.challengeId !== challengeId));
        } catch (error) {
            console.error('Error accepting challenge:', error);
        }
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
            <div className="absolute top-0 left-0 w-[250px] h-screen bg-transparent text-white overflow-y-auto p-5 z-[100]">
                <div className="flex justify-between mb-5 pb-2.5 border-b-2 border-white text-lg font-bold">
                    <h3 className="m-0">Players in Lobby</h3>
                    <span>
                        {lobbyState?.players?.length || 0}/10
                    </span>
                </div>
                <div>
                    {lobbyState?.players?.map(player => (
                        <div
                        key={player.id}
                        className={`bg-white/10 p-2.5 mb-2.5 rounded-md flex justify-between items-center ${player.id === playerId ? 'border border-black' : ''}`}
                            >
                            <span
                                className="text-xs overflow-hidden text-ellipsis whitespace-nowrap max-w-[120px]"
                                title={player.walletAddress}
                            >
                                {formatAddress(player.walletAddress)}
                            </span>
                            {player.id !== playerId ? (
                                <button
                                    className="bg-black hover:bg-slate-700 hover:scale-110 text-white border-none px-4 py-1 rounded cursor-pointer text-xs"
                                    onClick={() => {
                                        setTargetPlayerId(player.id);
                                        setCreateWagerModal(true);
                                    }}
                                >
                                    Challenge
                                </button>
                            ) : (
                                <span className="text-[10px] text-black">(You)</span>
                            )}
                        </div>
                    ))}
                </div>
            </div>
            {incomingChallenges.length > 0 && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/95 p-8 rounded-lg z-[1000] min-w-[400px] border-2 border-white text-white">
                    <h2 className="mt-0 text-white">Incoming Challenges</h2>
                    {incomingChallenges.map(challenge => {
                        const needsApproval = wcAllowance < challenge.wagerAmount;
                        const insufficientBalance = wcBalance < challenge.wagerAmount;
                        const canAccept = !isWrongChain && !insufficientBalance;

                        return (
                            <div key={challenge.challengeId} className="bg-white/10 p-4 mb-4 rounded-md">
                                <p className="my-1">
                                    <strong>
                                        Challenge from{' '}{formatAddress(challenge.challengerWallet)}
                                    </strong>
                                </p>
                                <p className="my-1">Wager: {challenge.wagerAmount} tokens</p>

                                {isWrongChain && (
                                    <p className="text-red-400 text-sm my-2">Wrong network - switch to Base</p>
                                )}

                                {!isWrongChain && insufficientBalance && (
                                    <p className="text-red-400 text-sm my-2">Insufficient balance</p>
                                )}

                                {!isWrongChain && !insufficientBalance && needsApproval && (
                                    <p className="text-yellow-400 text-sm my-2">Approval required</p>
                                )}

                                <div className="flex gap-2.5 mt-2.5">
                                    <button
                                        className="bg-green-600 hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white border-none px-5 py-2 rounded cursor-pointer flex-1 transition-colors"
                                        onClick={() => handleAcceptChallenge(challenge.challengeId)}
                                        disabled={!canAccept}
                                    >
                                        {needsApproval && canAccept ? 'Approve & Accept' : 'Accept'}
                                    </button>
                                    <button
                                        className="bg-red-600 hover:bg-red-700 text-white border-none px-5 py-2 rounded cursor-pointer flex-1 transition-colors"
                                        onClick={() => handleDeclineChallenge(challenge.challengeId)}
                                    >
                                        Decline
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
            {
                createWagerModal &&
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/95 p-8 rounded-lg z-[1000] min-w-[400px] border-2 border-white text-white flex flex-col items-center">
                    <h2 className="mt-0 text-white">How many $WC would you like to wager?</h2>
                    <div className="relative w-full mb-2">
                        <input
                            type="number"
                            min="0"
                            value={wager || ''}
                            onChange={(e) => setWager(Number(e.target.value))}
                            placeholder="Enter wager amount"
                            className="w-full p-2 pr-24 rounded bg-white text-black outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none">
                            Balance: {wcBalance?.toFixed(2) || '0.00'}
                        </span>
                    </div>

                    {isWrongChain && (
                        <p className="text-red-400 text-sm mb-4 w-full">Wrong network - switch to Base</p>
                    )}

                    {wager > 0 && wcBalance < wager && (
                        <p className="text-red-400 text-sm mb-4 w-full">Insufficient balance</p>
                    )}

                    {wager > 0 && wcAllowance < wager && wcBalance >= wager && (
                        <p className="text-yellow-400 text-sm mb-4 w-full">Approval required</p>
                    )}

                    <div className="flex gap-2.5 w-full">
                        <button
                            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white border-none px-5 py-2 rounded cursor-pointer flex-1 transition-colors"
                            onClick={sendWager}
                            disabled={isWrongChain || !wager || isNaN(wager) || wager <= 0 || wcBalance < wager || isApproving || isCreatingMatch}
                        >
                            {isApproving ? 'Approving...' : isCreatingMatch ? 'Creating Match...' : (wager > 0 && wcAllowance < wager && wcBalance >= wager) ? 'Approve' : 'Send Challenge'}
                        </button>
                        <button
                            className="bg-red-600 hover:bg-red-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white border-none px-5 py-2 rounded cursor-pointer flex-1 transition-colors"
                            onClick={cancelWager}
                            disabled={isApproving || isCreatingMatch}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            }
        </>
    );
}
