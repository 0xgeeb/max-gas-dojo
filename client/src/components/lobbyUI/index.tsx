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
            {/* Players Sidebar */}
            <div className="absolute top-0 left-0 w-full max-w-[400px] h-screen overflow-y-auto p-6 z-[100]">
                <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 p-5">
                    <div className="flex justify-between items-center mb-5 pb-4 border-b border-gray-200">
                        <h3 className="m-0 text-gray-900 text-lg font-semibold">Players in Lobby</h3>
                        <span className="text-gray-600 text-sm font-medium">
                            {lobbyState?.players?.length || 0}/10
                        </span>
                    </div>
                    <div className="space-y-2">
                        {lobbyState?.players?.map(player => (
                            <div
                                key={player.id}
                                className={`bg-gray-50 hover:bg-gray-100 p-3 rounded-lg flex items-center gap-3 transition-colors ${
                                    player.id === playerId ? 'ring-2 ring-gray-900' : ''
                                }`}
                            >
                                <span
                                    className="text-xs font-mono text-gray-700 flex-1"
                                    title={player.walletAddress}
                                >
                                    {formatAddress(player.walletAddress)}
                                </span>
                                {player.id === playerId ? (
                                    <span className="text-[10px] text-gray-500 font-medium">(You)</span>
                                ) : player.status === 'fighting' ? (
                                    <span className="text-[10px] text-gray-500 font-medium">(Fighting)</span>
                                ) : (
                                    <button
                                        className="bg-gray-900 hover:bg-gray-800 text-white border-none px-3 py-1.5 rounded-md cursor-pointer text-xs font-medium transition-colors shadow-sm"
                                        onClick={() => {
                                            setTargetPlayerId(player.id);
                                            setCreateWagerModal(true);
                                        }}
                                    >
                                        Challenge
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            {/* Incoming Challenges Modal */}
            {incomingChallenges.length > 0 && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2 className="mt-0 mb-6 text-gray-900 text-2xl font-semibold">Incoming Challenges</h2>
                        {incomingChallenges.map(challenge => {
                            const needsApproval = wcAllowance < challenge.wagerAmount;
                            const insufficientBalance = wcBalance < challenge.wagerAmount;
                            const canAccept = !isWrongChain && !insufficientBalance;

                            return (
                                <div key={challenge.challengeId} className="bg-gray-50 p-5 mb-4 rounded-lg border border-gray-200">
                                    <p className="my-2 text-gray-900">
                                        <strong className="font-semibold">
                                            Challenge from{' '}{formatAddress(challenge.challengerWallet)}
                                        </strong>
                                    </p>
                                    <p className="my-2 text-gray-700">Wager: <span className="font-semibold">{challenge.wagerAmount} tokens</span></p>

                                    {isWrongChain && (
                                        <p className="text-red-600 text-sm my-2 bg-red-50 px-3 py-2 rounded-md">Wrong network - switch to Base</p>
                                    )}

                                    {!isWrongChain && insufficientBalance && (
                                        <p className="text-red-600 text-sm my-2 bg-red-50 px-3 py-2 rounded-md">Insufficient balance</p>
                                    )}

                                    {!isWrongChain && !insufficientBalance && needsApproval && (
                                        <p className="text-yellow-700 text-sm my-2 bg-yellow-50 px-3 py-2 rounded-md">Approval required</p>
                                    )}

                                    <div className="flex gap-3 mt-4">
                                        <button
                                            className="btn-success flex-1"
                                            onClick={() => handleAcceptChallenge(challenge.challengeId)}
                                            disabled={!canAccept}
                                        >
                                            {needsApproval && canAccept ? 'Approve & Accept' : 'Accept'}
                                        </button>
                                        <button
                                            className="btn-danger flex-1"
                                            onClick={() => handleDeclineChallenge(challenge.challengeId)}
                                        >
                                            Decline
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
            {/* Create Wager Modal */}
            {createWagerModal && (
                <div className="modal-overlay">
                    <div className="modal-content flex flex-col items-center">
                        <h2 className="mt-0 mb-6 text-gray-900 text-2xl font-semibold">How many $WC would you like to wager?</h2>
                        <div className="relative w-full mb-4">
                            <input
                                type="number"
                                min="0"
                                value={wager || ''}
                                onChange={(e) => setWager(Number(e.target.value))}
                                placeholder="Enter wager amount"
                                className="input-field pr-28 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-mono pointer-events-none">
                                Balance: {wcBalance?.toFixed(2) || '0.00'}
                            </span>
                        </div>

                        {isWrongChain && (
                            <p className="text-red-600 text-sm mb-4 w-full bg-red-50 px-3 py-2 rounded-md">Wrong network - switch to Base</p>
                        )}

                        {wager > 0 && wcBalance < wager && (
                            <p className="text-red-600 text-sm mb-4 w-full bg-red-50 px-3 py-2 rounded-md">Insufficient balance</p>
                        )}

                        {wager > 0 && wcAllowance < wager && wcBalance >= wager && (
                            <p className="text-yellow-700 text-sm mb-4 w-full bg-yellow-50 px-3 py-2 rounded-md">Approval required</p>
                        )}

                        <div className="flex gap-3 w-full">
                            <button
                                className="btn-success flex-1"
                                onClick={sendWager}
                                disabled={isWrongChain || !wager || isNaN(wager) || wager <= 0 || wcBalance < wager || isApproving || isCreatingMatch}
                            >
                                {isApproving ? 'Approving...' : isCreatingMatch ? 'Creating Match...' : (wager > 0 && wcAllowance < wager && wcBalance >= wager) ? 'Approve' : 'Send Challenge'}
                            </button>
                            <button
                                className="btn-danger flex-1"
                                onClick={cancelWager}
                                disabled={isApproving || isCreatingMatch}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
